import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
import { isValidDateInput, type Equipment } from '@/lib/database';

const emptyValues = {
  nom: '',
  type: 'Routeur',
  localisation: '',
  date_installation: new Date().toISOString().slice(0, 10),
  ip: '',
  latitude: '',
  longitude: '',
  statut: 'En service',
};

export default function EquipementsScreen() {
  const db = useSQLiteContext();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setEquipment(await db.getAllAsync<Equipment>('SELECT * FROM equipements ORDER BY nom'));
    } catch (error) {
      console.error('Chargement des équipements impossible', error);
      Alert.alert('Erreur', 'La liste des équipements n’a pas pu être chargée.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const fields: FormField[] = [
    { key: 'nom', label: 'Nom de l’équipement', value: values.nom, placeholder: 'Ex. Cisco-R01' },
    { key: 'type', label: 'Type', value: values.type, options: ['Routeur', 'Switch', 'PC', 'Serveur', 'Autre'] },
    { key: 'localisation', label: 'Localisation', value: values.localisation, placeholder: 'Salle serveur A' },
    { key: 'date_installation', label: 'Date d’installation (AAAA-MM-JJ)', value: values.date_installation, placeholder: '2025-01-31' },
    { key: 'ip', label: 'Adresse IP (facultatif)', value: values.ip, placeholder: '192.168.1.1', autoCapitalize: 'none' },
    { key: 'statut', label: 'État', value: values.statut, options: ['En service', 'En panne', 'Hors service'] },
    { key: 'latitude', label: 'Latitude GPS (facultatif)', value: values.latitude, keyboardType: 'decimal-pad', placeholder: '5.3599' },
    { key: 'longitude', label: 'Longitude GPS (facultatif)', value: values.longitude, keyboardType: 'decimal-pad', placeholder: '-4.0083' },
  ];

  function openForm(item?: Equipment) {
    setEditing(item ?? null);
    setValues(item ? {
      nom: item.nom,
      type: item.type,
      localisation: item.localisation,
      date_installation: item.date_installation,
      ip: item.ip ?? '',
      latitude: item.latitude?.toString() ?? '',
      longitude: item.longitude?.toString() ?? '',
      statut: item.statut,
    } : { ...emptyValues });
    setVisible(true);
  }

  async function save() {
    const name = values.nom.trim();
    const location = values.localisation.trim();
    if (!name || !location || !isValidDateInput(values.date_installation)) {
      Alert.alert('Informations requises', 'Renseignez le nom, la localisation et une date AAAA-MM-JJ valide.');
      return;
    }
    const latitude = values.latitude.trim() ? Number(values.latitude.replace(',', '.')) : null;
    const longitude = values.longitude.trim() ? Number(values.longitude.replace(',', '.')) : null;
    if (
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      Alert.alert('Coordonnées invalides', 'Vérifiez les valeurs de latitude et de longitude.');
      return;
    }
    try {
      if (editing) {
        await db.runAsync(
          `UPDATE equipements SET nom=?, type=?, localisation=?, date_installation=?, ip=?, statut=?, latitude=?, longitude=? WHERE id=?`,
          name, values.type, location, values.date_installation, values.ip.trim() || null,
          values.statut, latitude, longitude, editing.id
        );
      } else {
        await db.runAsync(
          `INSERT INTO equipements (nom, type, localisation, date_installation, ip, statut, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          name, values.type, location, values.date_installation, values.ip.trim() || null,
          values.statut, latitude, longitude
        );
      }
      setVisible(false);
      await load();
    } catch (error) {
      console.error('Enregistrement de l’équipement impossible', error);
      Alert.alert('Erreur', 'L’équipement n’a pas pu être enregistré.');
    }
  }

  function remove(item: Equipment) {
    Alert.alert('Supprimer cet équipement ?', `${item.nom} et ses planifications seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const reminders = await db.getAllAsync<{ notification_id: string | null }>(
              'SELECT notification_id FROM maintenance_planifiee WHERE equipement_id = ?',
              item.id
            );
            await Promise.all(
              reminders
                .filter((reminder): reminder is { notification_id: string } => Boolean(reminder.notification_id))
                .map((reminder) => Notifications.cancelScheduledNotificationAsync(reminder.notification_id))
            );
            await db.runAsync('DELETE FROM equipements WHERE id = ?', item.id);
            await load();
          })().catch((error: unknown) => {
              console.error('Suppression de l’équipement impossible', error);
              Alert.alert('Erreur', 'La suppression a échoué.');
            });
        },
      },
    ]);
  }

  return (
    <Screen>
      <Heading eyebrow="Inventaire" title="Équipements" subtitle="Le parc matériel, enregistré localement sur votre appareil." />
      <ActionButton label="+  Nouvel équipement" onPress={() => openForm()} />
      <SectionTitle title={`${equipment.length} équipement${equipment.length > 1 ? 's' : ''}`} />
      {equipment.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>{item.nom}</Text>
              <Text style={{ color: palette.muted, fontSize: 13 }}>{item.type} · {item.localisation}</Text>
            </View>
            <Badge label={item.statut} tone={item.statut === 'En service' ? 'green' : 'red'} />
          </View>
          <Text style={{ color: palette.muted, fontSize: 12 }}>
            {item.ip ? `IP ${item.ip} · ` : ''}Installé le {item.date_installation}
          </Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <View style={{ flex: 1 }}><ActionButton label="Modifier" onPress={() => openForm(item)} variant="secondary" compact /></View>
            <View style={{ flex: 1 }}><ActionButton label="Supprimer" onPress={() => remove(item)} variant="danger" compact /></View>
          </View>
        </Card>
      ))}
      {!equipment.length ? <Card><Text style={{ color: palette.muted }}>Aucun équipement enregistré.</Text></Card> : null}
      <FormModal
        fields={fields}
        onCancel={() => setVisible(false)}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void save()}
        title={editing ? 'Modifier l’équipement' : 'Ajouter un équipement'}
        visible={visible}
      />
    </Screen>
  );
}
