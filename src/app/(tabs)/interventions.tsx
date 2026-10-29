import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActionButton,
  Card,
  FormModal,
  Heading,
  type FormField,
  palette,
  Screen,
  SectionTitle,
} from '@/components/maintenance-ui';
import { isValidDateInput, type Equipment, type Technician } from '@/lib/database';

type Intervention = {
  id: number;
  equipement_id: number;
  date: string;
  description: string;
  technicien_id: number | null;
  technicien: string | null;
  equipement: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyValues = { equipement: '', date: today(), technicien: 'Non attribué', description: '' };

export default function InterventionsScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Intervention[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [editing, setEditing] = useState<Intervention | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, assets, people] = await Promise.all([
        db.getAllAsync<Intervention>(
          `SELECT i.*, e.nom AS equipement, COALESCE(t.nom, i.technicien) AS technicien
           FROM interventions i
           JOIN equipements e ON e.id = i.equipement_id
           LEFT JOIN techniciens t ON t.id = i.technicien_id
           ORDER BY i.date DESC`
        ),
        db.getAllAsync<Equipment>('SELECT * FROM equipements ORDER BY nom'),
        db.getAllAsync<Technician>('SELECT * FROM techniciens ORDER BY nom'),
      ]);
      setItems(rows);
      setEquipment(assets);
      setTechnicians(people);
    } catch (error) {
      console.error('Chargement des interventions impossible', error);
      Alert.alert('Erreur', 'L’historique des interventions n’a pas pu être chargé.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const fields: FormField[] = [
    { key: 'equipement', label: 'Équipement', value: values.equipement, options: equipment.map((item) => item.nom) },
    { key: 'date', label: 'Date (AAAA-MM-JJ)', value: values.date, placeholder: '2026-10-29' },
    { key: 'technicien', label: 'Technicien affecté', value: values.technicien, options: ['Non attribué', ...technicians.map((item) => item.nom)] },
    { key: 'description', label: 'Description / réparation effectuée', value: values.description, placeholder: 'Diagnostic, actions et résultat', multiline: true },
  ];

  function openForm(item?: Intervention) {
    if (!equipment.length) {
      Alert.alert('Aucun équipement', 'Ajoutez un équipement avant de consigner une intervention.');
      return;
    }
    setEditing(item ?? null);
    setValues(item ? {
      equipement: item.equipement,
      date: item.date.slice(0, 10),
      technicien: item.technicien ?? 'Non attribué',
      description: item.description,
    } : { ...emptyValues, equipement: equipment[0].nom });
    setVisible(true);
  }

  async function save() {
    const asset = equipment.find((item) => item.nom === values.equipement);
    const technician = technicians.find((item) => item.nom === values.technicien);
    const date = new Date(`${values.date}T12:00:00`);
    if (!asset || !values.description.trim() || !isValidDateInput(values.date) || Number.isNaN(date.getTime())) {
      Alert.alert('Informations requises', 'Choisissez un équipement, une date valide et décrivez l’intervention.');
      return;
    }
    try {
      if (editing) {
        await db.runAsync(
          `UPDATE interventions SET equipement_id=?, date=?, description=?, technicien_id=?, technicien=? WHERE id=?`,
          asset.id, date.toISOString(), values.description.trim(), technician?.id ?? null,
          technician?.nom ?? null, editing.id
        );
      } else {
        await db.runAsync(
          `INSERT INTO interventions (equipement_id, date, description, technicien_id, technicien) VALUES (?, ?, ?, ?, ?)`,
          asset.id, date.toISOString(), values.description.trim(), technician?.id ?? null,
          technician?.nom ?? null
        );
      }
      setVisible(false);
      await load();
    } catch (error) {
      console.error('Enregistrement de l’intervention impossible', error);
      Alert.alert('Erreur', 'L’intervention n’a pas pu être enregistrée.');
    }
  }

  function remove(item: Intervention) {
    Alert.alert('Supprimer cette intervention ?', `${item.equipement} · ${item.description}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void db.runAsync('DELETE FROM interventions WHERE id = ?', item.id)
            .then(load)
            .catch((error: unknown) => {
              console.error('Suppression de l’intervention impossible', error);
              Alert.alert('Erreur', 'L’intervention n’a pas pu être supprimée.');
            });
        },
      },
    ]);
  }

  return (
    <Screen>
      <Heading eyebrow="Journal de maintenance" title="Interventions" subtitle="Consignez les opérations effectuées, le matériel et le technicien affecté." />
      <ActionButton label="+  Consigner une intervention" onPress={() => openForm()} />
      <SectionTitle title={`${items.length} intervention${items.length > 1 ? 's' : ''}`} />
      {items.map((item) => (
        <Card key={item.id}>
          <View style={{ gap: 5 }}>
            <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>{item.equipement}</Text>
            <Text style={{ color: palette.muted, fontSize: 12 }}>
              {new Date(item.date).toLocaleDateString('fr-FR')} · {item.technicien ?? 'Technicien non attribué'}
            </Text>
          </View>
          <Text style={{ color: palette.ink, fontSize: 14, lineHeight: 20 }}>{item.description}</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <View style={{ flex: 1 }}><ActionButton label="Modifier" onPress={() => openForm(item)} variant="secondary" compact /></View>
            <View style={{ flex: 1 }}><ActionButton label="Supprimer" onPress={() => remove(item)} variant="danger" compact /></View>
          </View>
        </Card>
      ))}
      {!items.length ? <Card><Text style={{ color: palette.muted }}>Aucune intervention consignée pour le moment.</Text></Card> : null}
      <FormModal
        fields={fields}
        onCancel={() => setVisible(false)}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void save()}
        title={editing ? 'Modifier l’intervention' : 'Nouvelle intervention'}
        visible={visible}
      />
    </Screen>
  );
}
