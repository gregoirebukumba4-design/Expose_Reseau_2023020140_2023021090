import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Card, Heading, palette, Screen, SectionTitle } from '@/components/maintenance-ui';
import { formatDate, type Maintenance } from '@/lib/database';

type Summary = { equipment: number; technicians: number; plans: number };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const network = useNetworkState();
  const [summary, setSummary] = useState<Summary>({ equipment: 0, technicians: 0, plans: 0 });
  const [upcoming, setUpcoming] = useState<Maintenance[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        try {
          const [equipment, technicians, plans, items] = await Promise.all([
            db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM equipements'),
            db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM techniciens'),
            db.getFirstAsync<{ count: number }>(
              "SELECT COUNT(*) AS count FROM maintenance_planifiee WHERE date >= datetime('now')"
            ),
            db.getAllAsync<Maintenance>(
              `SELECT m.*, e.nom AS equipement FROM maintenance_planifiee m
               JOIN equipements e ON e.id = m.equipement_id
               WHERE m.date >= datetime('now') ORDER BY m.date LIMIT 3`
            ),
          ]);
          if (active) {
            setSummary({
              equipment: equipment?.count ?? 0,
              technicians: technicians?.count ?? 0,
              plans: plans?.count ?? 0,
            });
            setUpcoming(items);
          }
        } catch (error) {
          console.error('Chargement du tableau de bord impossible', error);
          Alert.alert('Erreur', 'Le tableau de bord n’a pas pu être actualisé.');
        }
      }

      void load();
      return () => {
        active = false;
      };
    }, [db])
  );

  const online = network.isConnected === true && network.isInternetReachable !== false;
  return (
    <Screen>
      <Heading
        eyebrow="Gestion du parc informatique"
        title="Bonjour, technicien"
        subtitle="Votre atelier de maintenance, toujours à portée de main."
      />

      <Card style={{ backgroundColor: '#173A42', borderColor: '#173A42' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={{ color: '#A8D9CC', fontSize: 11, letterSpacing: 1.3, fontWeight: '800' }}>
              ÉTAT DE SYNCHRONISATION
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800' }}>
              {online ? 'Connexion disponible' : 'Mode hors ligne'}
            </Text>
            <Text style={{ color: '#C6D9DC', fontSize: 12 }}>
              {network.type ? `Réseau ${network.type}` : 'État réseau indisponible'}
            </Text>
          </View>
          <View style={{ justifyContent: 'center' }}>
            <Badge label={online ? 'EN LIGNE' : 'HORS LIGNE'} tone={online ? 'green' : 'amber'} />
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MetricCard label="Équipements" value={summary.equipment} color={palette.blue} />
        <MetricCard label="Techniciens" value={summary.technicians} color={palette.green} />
        <MetricCard label="À venir" value={summary.plans} color={palette.amber} />
      </View>

      <SectionTitle
        title="Prochaines interventions"
        action={
          <Pressable onPress={() => router.push('/maintenance')}>
            <Text style={{ color: palette.green, fontWeight: '800', fontSize: 13 }}>Tout voir</Text>
          </Pressable>
        }
      />
      {upcoming.length ? (
        upcoming.map((item) => (
          <Card key={item.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>
                  {item.equipement}
                </Text>
                <Text style={{ color: palette.muted, fontSize: 13 }}>
                  {formatDate(item.date)} · {item.commentaire || 'Aucun commentaire'}
                </Text>
              </View>
              <Badge label={item.type} tone={item.type === 'Preventive' ? 'green' : 'amber'} />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={{ color: palette.muted, fontSize: 14 }}>
            Aucune maintenance à venir. Créez une première planification.
          </Text>
        </Card>
      )}

      <SectionTitle title="Accès rapide" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <QuickLink label="Ajouter un équipement" onPress={() => router.push('/equipements')} />
        <QuickLink label="Planifier une visite" onPress={() => router.push('/maintenance')} />
        <QuickLink label="Consigner une intervention" onPress={() => router.push('/interventions')} />
        <QuickLink label="Outils terrain" onPress={() => router.push('/outils')} />
      </View>
    </Screen>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={{ flex: 1, padding: 13, gap: 6 }}>
      <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: palette.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Card>
  );
}

function QuickLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 13,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#E4F3EF',
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: palette.green, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
