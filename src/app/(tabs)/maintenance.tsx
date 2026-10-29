import { useCallback, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActionButton,
  Badge,
  Card,
  FormModal,
  Heading,
  type FormField,
  palette,
  Screen,
  SectionTitle,
} from '@/components/maintenance-ui';
import { formatDate, isValidDateInput, type Equipment, type Maintenance } from '@/lib/database';

const today = () => new Date().toISOString().slice(0, 10);
const emptyValues = { equipement: '', date: today(), type: 'Préventive', commentaire: '' };

export default function MaintenanceScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const [plans, assets] = await Promise.all([
        db.getAllAsync<Maintenance>(
          `SELECT m.*, e.nom AS equipement FROM maintenance_planifiee m
           JOIN equipements e ON e.id = m.equipement_id ORDER BY m.date`
        ),
        db.getAllAsync<Equipment>('SELECT * FROM equipements ORDER BY nom'),
      ]);
      setItems(plans);
      setEquipment(assets);
      setNow(Date.now());
    } catch (error) {
      console.error('Chargement du planning impossible', error);
      Alert.alert('Erreur', 'Le planning n’a pas pu être chargé.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const fields: FormField[] = [
    { key: 'equipement', label: 'Équipement', value: values.equipement, options: equipment.map((item) => item.nom) },
    { key: 'date', label: 'Date prévue (AAAA-MM-JJ)', value: values.date, placeholder: '2026-12-01' },
    { key: 'type', label: 'Type de maintenance', value: values.type, options: ['Préventive', 'Curative'] },
    { key: 'commentaire', label: 'Description / commentaire', value: values.commentaire, placeholder: 'Contrôles ou réparations à effectuer', multiline: true },
  ];

  function openForm(item?: Maintenance) {
    if (!equipment.length) {
      Alert.alert('Aucun équipement', 'Ajoutez un équipement avant de créer une maintenance.');
      return;
    }
    setEditing(item ?? null);
    setValues(item ? {
      equipement: item.equipement,
      date: item.date.slice(0, 10),
      type: item.type === 'Preventive' ? 'Préventive' : item.type,
      commentaire: item.commentaire ?? '',
    } : { ...emptyValues, equipement: equipment[0].nom });
    setVisible(true);
  }

  async function createReminder(dateText: string, equipmentName: string, kind: string) {
    const plannedDate = new Date(`${dateText}T09:00:00`);
    if (plannedDate.getTime() <= Date.now()) return null;
    const permissions = await Notifications.requestPermissionsAsync();
    if (!permissions.granted) return null;
    const reminderDate = new Date(plannedDate.getTime() - 24 * 60 * 60 * 1000);
    const triggerDate = reminderDate.getTime() > Date.now() ? reminderDate : plannedDate;
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Maintenance à échéance',
        body: `${kind} prévue pour ${equipmentName} le ${formatDate(dateText)}.`,
        data: { screen: 'maintenance' },
        ...(Platform.OS === 'android' ? { channelId: 'maintenance' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }

  async function save() {
    const selectedEquipment = equipment.find((item) => item.nom === values.equipement);
    const parsedDate = new Date(`${values.date}T09:00:00`);
    if (!selectedEquipment || !isValidDateInput(values.date) || Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Informations requises', 'Choisissez un équipement et saisissez une date AAAA-MM-JJ valide.');
      return;
    }
    let newNotificationId: string | null = null;
    try {
      newNotificationId = await createReminder(values.date, selectedEquipment.nom, values.type);
      if (editing) {
        await db.runAsync(
          'UPDATE maintenance_planifiee SET equipement_id=?, date=?, type=?, commentaire=?, notification_id=? WHERE id=?',
          selectedEquipment.id, parsedDate.toISOString(), values.type, values.commentaire.trim() || null,
          newNotificationId, editing.id
        );
        if (editing.notification_id && editing.notification_id !== newNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(editing.notification_id);
        }
      } else {
        await db.runAsync(
          'INSERT INTO maintenance_planifiee (equipement_id, date, type, commentaire, notification_id) VALUES (?, ?, ?, ?, ?)',
          selectedEquipment.id, parsedDate.toISOString(), values.type, values.commentaire.trim() || null,
          newNotificationId
        );
      }
      setVisible(false);
      await load();
      if (parsedDate.getTime() > Date.now() && !newNotificationId) {
        Alert.alert('Planification enregistrée', 'Le rappel n’a pas été activé. Autorisez les notifications dans les réglages pour recevoir les alertes.');
      }
    } catch (error) {
      if (newNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(newNotificationId).catch((cancelError: unknown) => {
          console.error('Annulation du rappel après erreur impossible', cancelError);
        });
      }
      console.error('Enregistrement de la maintenance impossible', error);
      Alert.alert('Erreur', 'La planification n’a pas pu être enregistrée.');
    }
  }

  function remove(item: Maintenance) {
    Alert.alert('Supprimer la planification ?', `${item.equipement} · ${formatDate(item.date)}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void db.runAsync('DELETE FROM maintenance_planifiee WHERE id = ?', item.id)
            .then(async () => {
              if (item.notification_id) {
                await Notifications.cancelScheduledNotificationAsync(item.notification_id);
              }
              await load();
            })
            .catch((error: unknown) => {
              console.error('Suppression de la planification impossible', error);
              Alert.alert('Erreur', 'La planification n’a pas pu être supprimée.');
            });
        },
      },
    ]);
  }

  const upcoming = items.filter((item) => new Date(item.date).getTime() >= now);
  const history = items.filter((item) => new Date(item.date).getTime() < now);
  return (
    <Screen>
      <Heading eyebrow="Organisation des interventions" title="Planning" subtitle="Planifiez les opérations et recevez un rappel à l’approche de l’échéance." />
      <ActionButton label="+  Planifier une maintenance" onPress={() => openForm()} />
      <SectionTitle title="À venir" />
      {upcoming.map((item) => (
        <PlanCard key={item.id} item={item} onEdit={() => openForm(item)} onRemove={() => remove(item)} />
      ))}
      {!upcoming.length ? <Card><Text style={{ color: palette.muted }}>Aucune maintenance à venir.</Text></Card> : null}
      {history.length ? (
        <>
          <SectionTitle title="Historique" />
          {history.map((item) => (
            <Card key={item.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: palette.ink, fontWeight: '800' }}>{item.equipement}</Text>
                  <Text style={{ color: palette.muted, fontSize: 13 }}>{formatDate(item.date)} · {item.commentaire || 'Sans commentaire'}</Text>
                </View>
                <Badge label="Terminée" tone="grey" />
              </View>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <View style={{ flex: 1 }}><ActionButton label="Modifier" onPress={() => openForm(item)} variant="secondary" compact /></View>
                <View style={{ flex: 1 }}><ActionButton label="Supprimer" onPress={() => remove(item)} variant="danger" compact /></View>
              </View>
            </Card>
          ))}
        </>
      ) : null}
      <FormModal
        fields={fields}
        onCancel={() => setVisible(false)}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void save()}
        title={editing ? 'Modifier la maintenance' : 'Nouvelle maintenance'}
        visible={visible}
      />
    </Screen>
  );
}

function PlanCard({ item, onEdit, onRemove }: { item: Maintenance; onEdit: () => void; onRemove: () => void }) {
  const kind = item.type === 'Preventive' ? 'Préventive' : item.type === 'Curative' ? 'Curative' : item.type;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>{item.equipement}</Text>
          <Text style={{ color: palette.muted, fontSize: 13 }}>{formatDate(item.date)} · 09:00</Text>
        </View>
        <Badge label={kind} tone={kind === 'Préventive' ? 'green' : 'amber'} />
      </View>
      <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>{item.commentaire || 'Aucun commentaire ajouté.'}</Text>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <View style={{ flex: 1 }}><ActionButton label="Modifier" onPress={onEdit} variant="secondary" compact /></View>
        <View style={{ flex: 1 }}><ActionButton label="Supprimer" onPress={onRemove} variant="danger" compact /></View>
      </View>
    </Card>
  );
}
