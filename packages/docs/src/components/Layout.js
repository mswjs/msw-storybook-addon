import { tw } from 'twind';

export function Columns({ children }) {
  return (
    <div className={tw`flex flex-wrap gap-8`}>
      {children}
    </div>
  );
}
