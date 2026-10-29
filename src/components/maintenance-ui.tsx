import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = {
  background: '#F4F7F9',
  card: '#FFFFFF',
  ink: '#162B36',
  muted: '#71818A',
  line: '#E4EAED',
  green: '#147D68',
  greenSoft: '#E4F3EF',
  blue: '#2676A8',
  blueSoft: '#E8F2F9',
  amber: '#B7791F',
  amberSoft: '#FFF4DF',
  red: '#B34D45',
  redSoft: '#FCEBE9',
};

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Heading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'quiet' && styles.buttonQuiet,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text
        style={[
          styles.buttonText,
          (variant === 'secondary' || variant === 'quiet') && styles.buttonTextDark,
          variant === 'danger' && styles.buttonTextDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA7AD"
        style={[styles.input, multiline && styles.multiline]}
        value={value}
      />
    </View>
  );
}

export type FormField = {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  options?: string[];
};

export function FormModal({
  visible,
  title,
  fields,
  onChange,
  onCancel,
  onSave,
}: {
  visible: boolean;
  title: string;
  fields: FormField[];
  onChange: (key: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>{title}</Text>
          {fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              {field.options ? (
                <View style={styles.choices}>
                  {field.options.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => onChange(field.key, option)}
                      style={[
                        styles.choice,
                        field.value === option && styles.choiceSelected,
                      ]}>
                      <Text
                        style={[
                          styles.choiceText,
                          field.value === option && styles.choiceTextSelected,
                        ]}>
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <TextInput
                  accessibilityLabel={field.label}
                  autoCapitalize={field.autoCapitalize ?? 'sentences'}
                  keyboardType={field.keyboardType}
                  multiline={field.multiline}
                  onChangeText={(value) => onChange(field.key, value)}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9AA7AD"
                  style={[styles.input, field.multiline && styles.multiline]}
                  value={field.value}
                />
              )}
            </View>
          ))}
          <View style={styles.modalActions}>
            <ActionButton label="Annuler" onPress={onCancel} variant="quiet" />
            <ActionButton label="Enregistrer" onPress={onSave} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function Badge({
  label,
  tone = 'green',
}: {
  label: string;
  tone?: 'green' | 'blue' | 'amber' | 'red' | 'grey';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'green' && styles.badgeGreen,
        tone === 'blue' && styles.badgeBlue,
        tone === 'amber' && styles.badgeAmber,
        tone === 'red' && styles.badgeRed,
        tone === 'grey' && styles.badgeGrey,
      ]}>
      <Text
        style={[
          styles.badgeText,
          tone === 'green' && { color: palette.green },
          tone === 'blue' && { color: palette.blue },
          tone === 'amber' && { color: palette.amber },
          tone === 'red' && { color: palette.red },
          tone === 'grey' && { color: palette.muted },
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <Text style={styles.empty}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  modalSafe: { flex: 1, backgroundColor: palette.background },
  modalContent: { padding: 22, gap: 18 },
  modalTitle: { color: palette.ink, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20, backgroundColor: '#EEF1F2' },
  choiceSelected: { backgroundColor: palette.greenSoft },
  choiceText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  choiceTextSelected: { color: palette.green },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 18 },
  heading: { gap: 5, marginBottom: 2 },
  eyebrow: { color: palette.green, fontSize: 11, letterSpacing: 1.6, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 27, lineHeight: 33, fontWeight: '800' },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF1F2',
    gap: 12,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  button: {
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonCompact: { minHeight: 37, paddingHorizontal: 12, borderRadius: 11 },
  buttonPrimary: { backgroundColor: palette.green },
  buttonSecondary: { backgroundColor: palette.greenSoft },
  buttonDanger: { backgroundColor: palette.redSoft },
  buttonQuiet: { backgroundColor: '#F1F4F5' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  buttonTextDark: { color: palette.green },
  buttonTextDanger: { color: palette.red },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  field: { gap: 7 },
  fieldLabel: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: palette.ink,
    fontSize: 15,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeGreen: { backgroundColor: palette.greenSoft },
  badgeBlue: { backgroundColor: palette.blueSoft },
  badgeAmber: { backgroundColor: palette.amberSoft },
  badgeRed: { backgroundColor: palette.redSoft },
  badgeGrey: { backgroundColor: '#EEF1F2' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { color: palette.muted, fontSize: 14, lineHeight: 21 },
});
