import { Ico } from '../data/icons';

export interface DocRef {
  kind: 'estudio' | 'poliza' | 'documento';
  title: string;
  subtitle: string;
  meta?: string;
}

interface Props { doc: DocRef; brand: string; onClose: () => void; }

export function DocumentViewer({ doc, brand, onClose }: Props) {
  return (
    <div onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(28,28,30,0.55)', zIndex:300, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'40px 20px', overflowY:'auto'}}>
      <div onClick={e => e.stopPropagation()} style={{width:'min(820px, 100%)', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(0,0,0,0.5)', borderRadius:8, marginBottom:12, color:'#fff', backdropFilter:'blur(8px)'}}>
        <div style={{fontSize:13, fontFamily:'Franklin Gothic', fontWeight:500}}>{doc.title}</div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button style={{background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', padding:'5px 10px', borderRadius:6, fontSize:11.5, fontFamily:'Franklin Gothic', fontWeight:500, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5}}>{Ico.download} Descargar</button>
          <span onClick={onClose} style={{cursor:'pointer', display:'flex', padding:4}}>{Ico.x}</span>
        </div>
      </div>

      <div onClick={e => e.stopPropagation()} style={{width:'min(820px, 100%)', minHeight:1060, background:'#fff', borderRadius:4, boxShadow:'0 24px 80px rgba(0,0,0,0.35)', padding:'60px 70px', display:'flex', flexDirection:'column'}}>
        <div style={{borderBottom:'2px solid #1C1C1E', paddingBottom:16, marginBottom:24}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:11, letterSpacing:1.4, textTransform:'uppercase', color:brand}}>CHRISTUS Muguerza</div>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:22, marginTop:4, letterSpacing:-0.2}}>{doc.title}</div>
              <div style={{fontSize:12.5, color:'#3C3C43', marginTop:4}}>{doc.subtitle}</div>
            </div>
            <div style={{textAlign:'right', fontSize:11, color:'#8E8E93', fontFamily:'Roboto Mono, monospace'}}>
              <div>Folio: {Math.floor(Math.random()*900000+100000)}</div>
              <div style={{marginTop:2}}>Emitido: 27 Abr 2026</div>
            </div>
          </div>
        </div>

        {doc.meta && <div style={{fontSize:12.5, color:'#3C3C43', padding:'10px 14px', background:'#FAFAF8', borderRadius:8, marginBottom:24}}>{doc.meta}</div>}

        <div style={{flex:1, minHeight:600, border:'2px dashed #E5E5EA', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, gap:14}}>
          <div style={{width:64, height:64, borderRadius:16, background:'#F2F2F7', color:'#8E8E93', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{transform:'scale(2)', display:'flex'}}>{Ico.file}</span>
          </div>
          <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:15, color:'#3C3C43'}}>Documento PDF · pendiente de carga</div>
          <div style={{fontSize:12, color:'#8E8E93', textAlign:'center', maxWidth:380, lineHeight:1.5}}>
            El archivo se mostrará aquí una vez que esté disponible en el sistema.<br/>
            Tipo: {doc.kind === 'estudio' ? 'Resultado de laboratorio' : doc.kind === 'poliza' ? 'Póliza de cobertura SGMM' : 'Documento clínico'}.
          </div>
        </div>

        <div style={{borderTop:'1px solid #E5E5EA', marginTop:24, paddingTop:14, display:'flex', justifyContent:'space-between', fontSize:10.5, color:'#8E8E93', fontFamily:'Roboto Mono, monospace'}}>
          <span>connect.christusmuguerza.com.mx</span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}
