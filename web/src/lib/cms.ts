export type CmsFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'color' | 'url' | 'image' | 'list';

export interface CmsField {
  key: string;
  type: CmsFieldType;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: { value: string; label: string }[];
  fields?: CmsField[];
  maxItems?: number;
}

export interface CmsSection {
  key: string;
  label: string;
  description?: string;
  fields: CmsField[];
}

export type CmsContent = Record<string, Record<string, unknown>>;
export type CmsImageRef = { id: string; alt: string } | null;

export interface CmsAsset {
  id: string;
  name: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface CmsVersion {
  revision: number;
  authorId: string;
  createdAt: string;
  content: CmsContent;
}

export interface CmsSiteSummary {
  id: number;
  name: string;
  url: string | null;
  revision: number;
  updatedAt: string;
  connected: boolean;
  sections: number;
  lastFetchAt: string | null;
  assets: number;
}

export interface CmsEditorData {
  site: { id: number; name: string; url: string | null; revision: number; updatedAt: string; connected: boolean; webhook: boolean };
  schema: { sections: CmsSection[] };
  content: CmsContent;
  assets: CmsAsset[];
  versions: CmsVersion[];
}

export const assetSrc = (siteId: number, assetId: string) => `/api/strony/${siteId}/obrazy/${assetId}`;
