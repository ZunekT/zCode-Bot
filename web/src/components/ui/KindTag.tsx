import { Icon } from '../Icon';

export function KindTag({ kind }: { kind?: string }) {
  const web = kind === 'WEBSITE';
  return (
    <span className={`kind-tag ${web ? 'web' : 'bot'}`}>
      <Icon name={web ? 'laptop' : 'bot'} size={16} />
      {web ? 'Strona' : 'Bot'}
    </span>
  );
}
