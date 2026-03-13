/**
 * Minimal mirror of CrudFactory's type definitions.
 * Kept here as documentation and for runtime validation reference.
 */

export type SupportedFieldType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'ObjectId'
  | 'Mixed';

export interface FieldSchema {
  type: SupportedFieldType;
  required?: boolean;
  unique?: boolean;
  ref?: string;
  enum?: string[];
  default?: unknown;
  min?: number;
  max?: number;
  message?: string;
  select?: boolean;
  match?: string;
  searchable?: true;
}

export type RecordConfigValue =
  | FieldSchema
  | RecordConfig
  | FieldSchema[]
  | RecordConfig[];

export interface RecordConfig {
  [key: string]: RecordConfigValue;
}

export interface RecordDefinition {
  record_name: string;
  record_config: RecordConfig;
}

export type ApiPermission = 'SCRUD' | 'SCRUDQ' | 'MCRUD' | 'MCRUDQ';
export type TextIndexStrategy = 'wildcard' | 'explicit';
export type DatabaseType = 'MongoDB';
