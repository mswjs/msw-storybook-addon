import { tw } from 'twind';
import { css } from 'twind/css';

const styles = css({
  gridTemplateColumns: `repeat(3, max-content)`,
});

export function Columns({ children }) {
  return <div className={tw`grid ${styles} gap-8`}>{children}</div>;
}
