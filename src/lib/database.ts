import type { SQLiteDatabase } from 'expo-sqlite';

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS equipements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      type TEXT NOT NULL,
      localisation TEXT NOT NULL,
      date_installation TEXT NOT NULL,
      ip TEXT,
      statut TEXT NOT NULL DEFAULT 'En service',
      latitude REAL,
      longitude REAL
    );
    CREATE TABLE IF NOT EXISTS techniciens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      specialite TEXT NOT NULL,
      telephone TEXT,
      contact_id TEXT
    );
    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipement_id INTEGER NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      technicien_id INTEGER REFERENCES techniciens(id) ON DELETE SET NULL,
      technicien TEXT
    );
    CREATE TABLE IF NOT EXISTS maintenance_planifiee (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipement_id INTEGER NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      commentaire TEXT,
      notification_id TEXT
    );
    CREATE TABLE IF NOT EXISTS medias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipement_id INTEGER REFERENCES equipements(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      stage TEXT,
      uri TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const mediaColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(medias)');
  if (!mediaColumns.some((column) => column.name === 'stage')) {
    await db.execAsync('ALTER TABLE medias ADD COLUMN stage TEXT');
  }

  const equipmentCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM equipements'
  );
  if (equipmentCount?.count === 0) {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO equipements (nom, type, localisation, date_installation, ip, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        'Cisco-R01',
        'Routeur',
        'Salle serveur A',
        '2023-02-14',
        '192.168.1.1',
        5.3599,
        -4.0083
      );
      await db.runAsync(
        'INSERT INTO equipements (nom, type, localisation, date_installation, ip, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        'Switch-S02',
        'Switch',
        'Batiment Reseau',
        '2024-06-20',
        '192.168.1.2',
        5.3604,
        -4.0076
      );
      await db.runAsync(
        'INSERT INTO equipements (nom, type, localisation, date_installation, ip, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        'PC-Admin-01',
        'PC',
        'Bureau informatique',
        '2025-01-08',
        '192.168.1.25',
        5.3595,
        -4.0088
      );
      await db.runAsync(
        'INSERT INTO techniciens (nom, specialite, telephone) VALUES (?, ?, ?)',
        'Awa Kouassi',
        'Reseau',
        '+225 07 00 00 00 01'
      );
      await db.runAsync(
        'INSERT INTO techniciens (nom, specialite, telephone) VALUES (?, ?, ?)',
        'Yao Nguessan',
        'Materiel',
        '+225 07 00 00 00 02'
      );
      await db.runAsync(
        'INSERT INTO maintenance_planifiee (equipement_id, date, type, commentaire) VALUES (1, ?, ?, ?)',
        new Date(Date.now() + 2 * 86400000).toISOString(),
        'Preventive',
        'Verifier les interfaces reseau et sauvegarder la configuration.'
      );
      await db.runAsync(
        'INSERT INTO maintenance_planifiee (equipement_id, date, type, commentaire) VALUES (2, ?, ?, ?)',
        new Date(Date.now() + 5 * 86400000).toISOString(),
        'Curative',
        'Diagnostic du port de liaison montant.'
      );
    });
  }
}

export type Equipment = {
  id: number;
  nom: string;
  type: string;
  localisation: string;
  date_installation: string;
  ip: string | null;
  statut: string;
  latitude: number | null;
  longitude: number | null;
};

export type Technician = {
  id: number;
  nom: string;
  specialite: string;
  telephone: string | null;
  contact_id: string | null;
};

export type Maintenance = {
  id: number;
  equipement_id: number;
  date: string;
  type: string;
  commentaire: string | null;
  notification_id: string | null;
  equipement: string;
};

export type Media = {
  id: number;
  equipement_id: number | null;
  type: 'photo' | 'audio';
  stage: 'Avant' | 'Après' | null;
  uri: string;
  created_at: string;
  equipement: string | null;
};

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
