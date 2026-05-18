import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  right?: string;
  onRight?: () => void;
}

export function SectionHeader({ title, right, onRight }: Props) {
  const { tokens } = useTheme();
  return (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'2px 2px 8px'}}>
      <div style={{fontFamily:'Franklin Gothic', fontWeight: 500, fontSize: 11, letterSpacing: 1.5, textTransform:'uppercase', color:tokens.textSecondary}}>{title}</div>
      {right && <div onClick={onRight} style={{fontSize: 12, color:'#671E75', fontFamily:'Franklin Gothic', fontWeight: 500, cursor: onRight ? 'pointer' : 'default'}}>{right} ›</div>}
    </div>
  );
}
