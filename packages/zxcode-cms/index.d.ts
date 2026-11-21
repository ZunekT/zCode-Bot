interface Base<T> {
  label: string;
  description?: string;
  default?: T;
  required?: boolean;
}

export interface CmsImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface FieldDef<T = unknown> {
  readonly __zxCmsField: true;
  readonly __value?: T;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'color' | 'url' | 'image' | 'list';
}

type ValueOf<F> = F extends FieldDef<infer T> ? T : never;
type ItemOf<F extends Record<string, FieldDef>> = { [K in keyof F]: ValueOf<F[K]> };

export declare const field: {
  text(o: Base<string> & { maxLength?: number }): FieldDef<string>;
  textarea(o: Base<string> & { maxLength?: number }): FieldDef<string>;
  number(o: Base<number> & { min?: number; max?: number; integer?: boolean }): FieldDef<number | null>;
  toggle(o: Base<boolean>): FieldDef<boolean>;
  select<V extends string>(o: Base<V> & { options: (V | { value: V; label: string })[] }): FieldDef<V>;
  color(o: Base<string>): FieldDef<string>;
  url(o: Base<string>): FieldDef<string>;
  image(o: Omit<Base<never>, 'default'>): FieldDef<CmsImage | null>;
  list<F extends Record<string, FieldDef>>(o: Omit<Base<never>, 'default'> & { fields: F; max?: number }): FieldDef<ItemOf<F>[]>;
};

export interface SectionDef {
  label: string;
  description?: string;
  fields: Record<string, FieldDef>;
}

export type Content<S extends Record<string, SectionDef>> = { [K in keyof S]: ItemOf<S[K]['fields']> };

export interface SiteOptions<S extends Record<string, SectionDef>> {
  sections: S;
  key?: string;
  url?: string;
  webhookUrl?: string;
  revalidate?: number | false;
  tag?: string;
  ttl?: number;
  timeout?: number;
  debug?: boolean;
}

export interface Site<S extends Record<string, SectionDef>> {
  readonly schema: unknown;
  readonly defaults: Content<S>;
  readonly tag: string;
  content(): Promise<Content<S>>;
  section<K extends keyof S>(name: K): Promise<Content<S>[K]>;
  webhook(onUpdate?: (payload: { event: string; siteId: number; revision: number }) => unknown): (request: Request) => Promise<Response>;
  invalidate(): void;
  sendSchema(): Promise<unknown>;
}

export declare function createSite<S extends Record<string, SectionDef>>(options: SiteOptions<S>): Site<S>;
export declare function verifySignature(key: string, timestamp: string | null, signature: string | null, body: string, now?: number): boolean;
export declare const CMS_VERSION: string;

declare const cms: { createSite: typeof createSite; field: typeof field; verifySignature: typeof verifySignature; CMS_VERSION: string };
export default cms;
