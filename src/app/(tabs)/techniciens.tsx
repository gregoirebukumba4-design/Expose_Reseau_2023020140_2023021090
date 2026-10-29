import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
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
import type { Technician } from '@/lib/database';

const emptyValues = { nom: '', specialite: 'Réseau', telephone: '' };
const contactFields = [ContactField.FULL_NAME, ContactField.PHONES] as const;
type PhoneContact = {
  id: string;
  fullName?: string | null;
  phones?: { number?: string | null }[];
};

export default function TechniciensScreen() {
  const db = useSQLiteContext();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [contactsVisible, setContactsVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setTechnicians(await db.getAllAsync<Technician>('SELECT * FROM techniciens ORDER BY nom'));
    } catch (error) {
      console.error('Chargement des techniciens impossible', error);
      Alert.alert('Erreur', 'La liste des techniciens n’a pas pu être chargée.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const fields: FormField[] = [
    { key: 'nom', label: 'Nom complet', value: values.nom, placeholder: 'Prénom et nom' },
    { key: 'specialite', label: 'Spécialité', value: values.specialite, options: ['Réseau', 'Matériel', 'Systèmes', 'Autre'] },
    { key: 'telephone', label: 'Téléphone', value: values.telephone, keyboardType: 'phone-pad', placeholder: '+225 …' },
  ];

  function openForm(item?: Technician) {
    setEditing(item ?? null);
    setValues(item ? {
      nom: item.nom,
      specialite: item.specialite,
      telephone: item.telephone ?? '',
    } : { ...emptyValues });
    setVisible(true);
  }

  async function save() {
    if (!values.nom.trim() || !values.specialite.trim()) {
      Alert.alert('Informations requises', 'Saisissez le nom et la spécialité du technicien.');
      return;
    }
    try {
      if (editing) {
        await db.runAsync(
          'UPDATE techniciens SET nom=?, specialite=?, telephone=? WHERE id=?',
          values.nom.trim(), values.specialite, values.telephone.trim() || null, editing.id
        );
      } else {
        await db.runAsync(
          'INSERT INTO techniciens (nom, specialite, telephone) VALUES (?, ?, ?)',
          values.nom.trim(), values.specialite, values.telephone.trim() || null
        );
      }
      setVisible(false);
      await load();
    } catch (error) {
      console.error('Enregistrement du technicien impossible', error);
      Alert.alert('Erreur', 'Le technicien n’a pas pu être enregistré.');
    }
  }

  async function importFromPhone() {
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Accès refusé', 'Autorisez l’accès aux contacts pour importer un technicien.');
        return;
      }
      const contacts = await Contact.getAllDetails(contactFields, { limit: 100 });
      if (!contacts.length) {
        Alert.alert('Carnet vide', 'Aucun contact à importer n’a été trouvé.');
        return;
      }
      setPhoneContacts(contacts);
      setContactsVisible(true);
    } catch (error) {
      console.error('Lecture des contacts impossible', error);
      Alert.alert('Erreur', 'Le carnet de contacts n’a pas pu être lu.');
    }
  }

  async function importContact(contact: PhoneContact) {
    const name = contact.fullName?.trim();
    if (!name) {
      Alert.alert('Nom manquant', 'Ce contact doit avoir un nom pour être ajouté.');
      return;
    }
    try {
      await db.runAsync(
        'INSERT INTO techniciens (nom, specialite, telephone, contact_id) VALUES (?, ?, ?, ?)',
        name, 'Réseau', contact.phones?.[0]?.number ?? null, contact.id
      );
      setContactsVisible(false);
      await load();
    } catch (error) {
      console.error('Import du contact impossible', error);
      Alert.alert('Erreur', 'Ce contact n’a pas pu être importé.');
    }
  }

  function remove(item: Technician) {
    Alert.alert('Supprimer ce technicien ?', item.nom, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void db.runAsync('DELETE FROM techniciens WHERE id = ?', item.id)
            .then(load)
            .catch((error: unknown) => {
              console.error('Suppression du technicien impossible', error);
              Alert.alert('Erreur', 'La suppression a échoué.');
            });
        },
      },
    ]);
  }

  return (
    <Screen>
      <Heading eyebrow="Ressources humaines" title="Techniciens" subtitle="Gérez l’équipe et affectez les interventions." />
      <View style={{ gap: 9 }}>
        <ActionButton label="+  Ajouter un technicien" onPress={() => openForm()} />
        <ActionButton label="Importer depuis les contacts" onPress={() => void importFromPhone()} variant="secondary" />
      </View>
      <SectionTitle title={`${technicians.length} technicien${technicians.length > 1 ? 's' : ''}`} />
      {technicians.map((item) => (
        <Card key={item.id}>
          <View style={{ gap: 5 }}>
            <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>{item.nom}</Text>
            <Text style={{ color: palette.muted, fontSize: 13 }}>{item.specialite}{item.telephone ? ` · ${item.telephone}` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <View style={{ flex: 1 }}><ActionButton label="Modifier" onPress={() => openForm(item)} variant="secondary" compact /></View>
            <View style={{ flex: 1 }}><ActionButton label="Supprimer" onPress={() => remove(item)} variant="danger" compact /></View>
          </View>
        </Card>
      ))}
      {!technicians.length ? <Card><Text style={{ color: palette.muted }}>Aucun technicien enregistré.</Text></Card> : null}
      <FormModal
        fields={fields}
        onCancel={() => setVisible(false)}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void save()}
        title={editing ? 'Modifier le technicien' : 'Ajouter un technicien'}
        visible={visible}
      />
      <Modal
        animationType="slide"
        onRequestClose={() => setContactsVisible(false)}
        presentationStyle="pageSheet"
        visible={contactsVisible}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
          <Text style={{ color: palette.ink, fontSize: 22, fontWeight: '800', marginBottom: 5 }}>
            Choisir un contact
          </Text>
          {phoneContacts.map((contact) => (
            <Pressable
              key={contact.id}
              onPress={() => void importContact(contact)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#E4F3EF' : '#FFFFFF',
                borderColor: '#E4EAED',
                borderWidth: 1,
                borderRadius: 14,
                padding: 15,
                gap: 5,
              })}>
              <Text style={{ color: palette.ink, fontSize: 15, fontWeight: '800' }}>
                {contact.fullName || 'Contact sans nom'}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 13 }}>
                {contact.phones?.[0]?.number || 'Aucun numéro de téléphone'}
              </Text>
            </Pressable>
          ))}
          <ActionButton label="Annuler" onPress={() => setContactsVisible(false)} variant="quiet" />
        </ScrollView>
      </Modal>
    </Screen>
  );
}
