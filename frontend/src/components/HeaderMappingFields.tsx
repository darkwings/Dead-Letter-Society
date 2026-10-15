import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export type HeaderPresetName = 'LEGACY' | 'SPRING' | 'QUARKUS_SMALLRYE' | 'CUSTOM'
export type HeaderEncoding = 'STRING' | 'INT32' | 'INT64'
export type HeaderFieldValue = { name: string; encoding: HeaderEncoding } | null
export interface HeaderMappingValue {
  originalTopic: HeaderFieldValue
  originalPartition: HeaderFieldValue
  originalOffset: HeaderFieldValue
  originalTimestamp: HeaderFieldValue
  exceptionMessage: HeaderFieldValue
  exceptionStacktrace: HeaderFieldValue
}

interface PresetResponse { preset: Exclude<HeaderPresetName, 'CUSTOM'>; mapping: HeaderMappingValue }

export const EMPTY_MAPPING: HeaderMappingValue = {
  originalTopic: null, originalPartition: null, originalOffset: null,
  originalTimestamp: null, exceptionMessage: null, exceptionStacktrace: null,
}

const FIELDS: { key: keyof HeaderMappingValue; label: string; encodings: HeaderEncoding[] }[] = [
  { key: 'originalTopic', label: 'Original Topic', encodings: ['STRING'] },
  { key: 'originalPartition', label: 'Original Partition', encodings: ['STRING', 'INT32'] },
  { key: 'originalOffset', label: 'Original Offset', encodings: ['STRING', 'INT64'] },
  { key: 'originalTimestamp', label: 'Original Timestamp', encodings: ['STRING', 'INT64'] },
  { key: 'exceptionMessage', label: 'Exception Message', encodings: ['STRING'] },
  { key: 'exceptionStacktrace', label: 'Exception Stacktrace', encodings: ['STRING'] },
]

interface Props {
  preset: HeaderPresetName
  /** The custom mapping; only used (and sent to the API) when preset is CUSTOM. */
  mapping: HeaderMappingValue
  onChange: (preset: HeaderPresetName, mapping: HeaderMappingValue) => void
}

export default function HeaderMappingFields({ preset, mapping, onChange }: Props) {
  const { data: presets = [] } = useQuery({
    queryKey: ['header-presets'],
    queryFn: () => apiFetch<PresetResponse[]>('/api/header-presets'),
    staleTime: Infinity,
  })
  const editable = preset === 'CUSTOM'
  const shown: HeaderMappingValue = editable
    ? mapping
    : presets.find(p => p.preset === preset)?.mapping ?? EMPTY_MAPPING

  function selectPreset(next: HeaderPresetName) {
    // Switching to CUSTOM starts from whatever is currently shown, so it can be tweaked.
    onChange(next, next === 'CUSTOM' ? shown : mapping)
  }

  function setField(key: keyof HeaderMappingValue, name: string, encoding: HeaderEncoding) {
    onChange('CUSTOM', { ...mapping, [key]: name.trim() === '' ? null : { name, encoding } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label htmlFor="headerPreset" style={{ fontSize: 12, fontWeight: 500 }}>Header Preset</label>
        <select id="headerPreset" className="select" value={preset}
          onChange={(e) => selectPreset(e.target.value as HeaderPresetName)}>
          <option value="LEGACY">Legacy (x-original-topic)</option>
          <option value="SPRING">Spring Kafka (kafka_dlt-*)</option>
          <option value="QUARKUS_SMALLRYE">Quarkus SmallRye (dead-letter-*)</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
      {FIELDS.map(({ key, label, encodings }) => {
        const value = shown[key]
        return (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <label htmlFor={`hdr-${key}`} style={{ fontSize: 12, fontWeight: 500 }}>{label} header</label>
              <input id={`hdr-${key}`} className="input" disabled={!editable}
                value={value?.name ?? ''}
                onChange={(e) => setField(key, e.target.value, value?.encoding ?? 'STRING')} />
            </div>
            {encodings.length > 1 && (
              <select aria-label={`${label} encoding`} className="select" style={{ width: 90, flexShrink: 0 }} disabled={!editable}
                value={value?.encoding ?? 'STRING'}
                onChange={(e) => value && setField(key, value.name, e.target.value as HeaderEncoding)}>
                {encodings.map(enc => <option key={enc} value={enc}>{enc}</option>)}
              </select>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
