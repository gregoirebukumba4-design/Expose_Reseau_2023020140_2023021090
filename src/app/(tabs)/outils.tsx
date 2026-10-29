import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Maps from 'expo-maps';
import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActionButton,
  Badge,
  Card,
  Heading,
  palette,
  Screen,
  SectionTitle,
} from '@/components/maintenance-ui';
import type { Equipment, Media } from '@/lib/database';

type Coordinates = { latitude: number; longitude: number };
const defaultCoordinates = { latitude: 5.3599, longitude: -4.0083 };

export default function OutilsScreen() {
  const db = useSQLiteContext();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [photoStage, setPhotoStage] = useState<'Avant' | 'Après'>('Avant');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const network = useNetworkState();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recording = useAudioRecorderState(recorder);

  const load = useCallback(async () => {
    try {
      const [assets, files] = await Promise.all([
        db.getAllAsync<Equipment>('SELECT * FROM equipements ORDER BY nom'),
        db.getAllAsync<Media>(
          `SELECT m.*, e.nom AS equipement FROM medias m LEFT JOIN equipements e ON e.id = m.equipement_id
           ORDER BY m.created_at DESC LIMIT 30`
        ),
      ]);
      setEquipment(assets);
      setMedia(files);
      setSelectedId((current) => current ?? assets[0]?.id ?? null);
    } catch (error) {
      console.error('Chargement des outils terrain impossible', error);
      Alert.alert('Erreur', 'Les données des outils terrain n’ont pas pu être chargées.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const selectedEquipment = equipment.find((item) => item.id === selectedId) ?? null;
  const center = useMemo(
    () => position ?? (selectedEquipment?.latitude && selectedEquipment.longitude
      ? { latitude: selectedEquipment.latitude, longitude: selectedEquipment.longitude }
      : defaultCoordinates),
    [position, selectedEquipment]
  );
  const online = network.isConnected === true && network.isInternetReachable !== false;
  const markers = useMemo(() => [
    ...equipment
      .filter((item): item is Equipment & { latitude: number; longitude: number } =>
        item.latitude !== null && item.longitude !== null
      )
      .map((item) => ({
        id: `equipment-${item.id}`,
        coordinates: { latitude: item.latitude, longitude: item.longitude },
        title: item.nom,
        snippet: `${item.type} · ${item.localisation}`,
      })),
    ...(position ? [{
      id: 'technician',
      coordinates: position,
      title: 'Position du technicien',
      snippet: 'Position actuelle',
    }] : []),
  ], [equipment, position]);

  async function locateTechnician() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Localisation refusée', 'Autorisez la localisation pour afficher votre position sur la carte.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error) {
      console.error('Localisation impossible', error);
      Alert.alert('Erreur GPS', 'La position actuelle n’a pas pu être récupérée.');
    }
  }

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Accès à la caméra refusé', 'Autorisez la caméra pour documenter l’intervention.');
        return;
      }
    }
    setCameraVisible(true);
  }

  async function savePhoto() {
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (!picture?.uri || !FileSystem.documentDirectory) {
        throw new Error('La caméra n’a renvoyé aucune photo.');
      }
      const directory = `${FileSystem.documentDirectory}maintenance_media/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const destination = `${directory}photo-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: picture.uri, to: destination });
      await db.runAsync(
        'INSERT INTO medias (equipement_id, type, stage, uri, created_at) VALUES (?, ?, ?, ?, ?)',
        selectedId, 'photo', photoStage, destination, new Date().toISOString()
      );
      setCameraVisible(false);
      await load();
      Alert.alert('Photo sauvegardée', 'La photo est enregistrée dans les fichiers de l’application et liée à l’équipement sélectionné.');
    } catch (error) {
      console.error('Capture ou sauvegarde de la photo impossible', error);
      Alert.alert('Erreur', 'La photo n’a pas pu être sauvegardée.');
    }
  }

  async function toggleRecording() {
    try {
      if (recording.isRecording) {
        await recorder.stop();
        if (!recorder.uri) throw new Error('Aucun fichier audio n’a été créé.');
        await db.runAsync(
          'INSERT INTO medias (equipement_id, type, uri, created_at) VALUES (?, ?, ?, ?)',
          selectedId, 'audio', recorder.uri, new Date().toISOString()
        );
        await load();
        Alert.alert('Mémo sauvegardé', 'L’enregistrement vocal a été enregistré.');
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Accès au microphone refusé', 'Autorisez le microphone pour enregistrer un mémo vocal.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.error('Enregistrement audio impossible', error);
      Alert.alert('Erreur audio', 'Le mémo vocal n’a pas pu être enregistré.');
    }
  }

  return (
    <Screen>
      <Heading eyebrow="Outils du technicien" title="Sur le terrain" subtitle="Connexion, position, audit photo et notes vocales." />
      <Card style={{ backgroundColor: online ? '#E4F3EF' : '#FFF4DF', borderColor: online ? '#CDE8E0' : '#F5E5C5' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: palette.ink, fontWeight: '800', fontSize: 15 }}>
              {online ? 'Connexion Internet active' : 'Fonctionnement hors ligne'}
            </Text>
            <Text style={{ color: palette.muted, fontSize: 12 }}>
              {network.type ? `Réseau ${network.type}` : 'État du réseau inconnu'}
            </Text>
          </View>
          <Badge label={online ? 'EN LIGNE' : 'HORS LIGNE'} tone={online ? 'green' : 'amber'} />
        </View>
      </Card>

      <SectionTitle title="Position & équipements" />
      <Card style={{ padding: 8, overflow: 'hidden' }}>
        <View style={{ height: 245, borderRadius: 13, overflow: 'hidden' }}>
          {Platform.OS === 'android' ? (
            <Maps.GoogleMaps.View
              style={{ flex: 1 }}
              cameraPosition={{ coordinates: center, zoom: 15 }}
              markers={markers}
              properties={{ isMyLocationEnabled: Boolean(position) }}
              uiSettings={{ compassEnabled: true, myLocationButtonEnabled: true }}
            />
          ) : Platform.OS === 'ios' ? (
            <Maps.AppleMaps.View
              style={{ flex: 1 }}
              cameraPosition={{ coordinates: center, zoom: 15 }}
              annotations={markers.map((marker) => ({
                id: marker.id,
                coordinates: marker.coordinates,
                title: marker.title,
                subtitle: marker.snippet,
              }))}
              properties={{ isMyLocationEnabled: Boolean(position) }}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F2F1', padding: 18 }}>
              <Text style={{ color: palette.ink, fontWeight: '700', textAlign: 'center' }}>
                La carte native est disponible dans les applications Android et iOS.
              </Text>
            </View>
          )}
        </View>
        <View style={{ padding: 8, gap: 10 }}>
          <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18 }}>
            {position
              ? `Technicien : ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : 'Sélectionnez un équipement ou récupérez votre position GPS.'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {equipment.map((item) => (
              <ActionButton
                key={item.id}
                compact
                label={item.nom}
                onPress={() => setSelectedId(item.id)}
                variant={item.id === selectedId ? 'primary' : 'quiet'}
              />
            ))}
          </View>
          <ActionButton label="Afficher ma position GPS" onPress={() => void locateTechnician()} variant="secondary" />
        </View>
      </Card>

      <SectionTitle title="Audit visuel" />
      <Card>
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
          Photographiez une étiquette ou l’état du matériel. La photo est stockée dans les documents privés de l’application.
        </Text>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ flex: 1 }}>
            <ActionButton
              label="Avant intervention"
              onPress={() => setPhotoStage('Avant')}
              variant={photoStage === 'Avant' ? 'primary' : 'quiet'}
              compact
            />
          </View>
          <View style={{ flex: 1 }}>
            <ActionButton
              label="Après intervention"
              onPress={() => setPhotoStage('Après')}
              variant={photoStage === 'Après' ? 'primary' : 'quiet'}
              compact
            />
          </View>
        </View>
        <ActionButton label="Prendre une photo" onPress={() => void openCamera()} />
      </Card>

      <SectionTitle title="Note vocale" />
      <Card>
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
          Enregistrez l’état de l’équipement ou les réparations à prévoir.
        </Text>
        <ActionButton
          label={recording.isRecording ? 'Arrêter et sauvegarder' : 'Démarrer un mémo vocal'}
          onPress={() => void toggleRecording()}
          variant={recording.isRecording ? 'danger' : 'secondary'}
        />
        {recording.isRecording ? (
          <Text style={{ color: palette.red, fontSize: 12, fontWeight: '700' }}>
            Enregistrement en cours · {Math.floor(recording.durationMillis / 1000)} s
          </Text>
        ) : null}
      </Card>

      <SectionTitle title="Médias sauvegardés" />
      {media.map((item) => (
        <MediaRow key={item.id} item={item} />
      ))}
      {!media.length ? <Card><Text style={{ color: palette.muted }}>Les photos et mémos enregistrés apparaîtront ici.</Text></Card> : null}

      <Modal animationType="slide" onRequestClose={() => setCameraVisible(false)} visible={cameraVisible}>
        <View style={{ flex: 1, backgroundColor: '#07151A' }}>
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
          <View style={{ padding: 20, gap: 10 }}>
            <ActionButton label="Capturer et sauvegarder" onPress={() => void savePhoto()} />
            <ActionButton label="Fermer la caméra" onPress={() => setCameraVisible(false)} variant="quiet" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MediaRow({ item }: { item: Media }) {
  const player = useAudioPlayer(item.type === 'audio' ? item.uri : null);
  const date = new Date(item.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: palette.ink, fontWeight: '800' }}>
            {item.type === 'photo'
              ? `${item.stage ? `${item.stage} · ` : ''}Photo d’audit`
              : 'Mémo vocal'}{item.equipement ? ` · ${item.equipement}` : ''}
          </Text>
          <Text style={{ color: palette.muted, fontSize: 12 }}>{date}</Text>
        </View>
        {item.type === 'audio' ? (
          <ActionButton label="Écouter" onPress={() => player.play()} compact variant="secondary" />
        ) : (
          <Image source={{ uri: item.uri }} style={{ width: 52, height: 52, borderRadius: 10 }} />
        )}
      </View>
    </Card>
  );
}
