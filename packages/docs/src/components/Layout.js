import { tw } from 'twind';
import { css } from 'twind/css';

const styles = css({
  gridTemplateColumns: `repeat(3, max-content)`,
});

export function Columns({ children }) {
  return <div className={tw`grid ${styles} bg-blue-100 text-lg gap-8`}>{children}</div>;
}
