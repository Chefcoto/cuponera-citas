import React, { useState, useEffect } from 'react';

export default function App() {
  const [cupones, setCupones] = useState(() => {
    const saved = localStorage.getItem('cupones_citas');
    return saved ? JSON.parse(saved) : [];
  });

  const [sugerenciasActivas, setSugerenciasActivas] = useState(() => {
    const saved = localStorage.getItem('sugerencias_activas');
    return saved ? JSON.parse(saved) : [];
  });

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('cupones_config');
    return saved ? JSON.parse(saved) : {
      maxQuincenal: 4,
      maxMensual: 2,
      cooldownGoldenDias: 60,
      maxGoldenVisibles: 1
    };
  });

  const [tempConfig, setTempConfig] = useState(config);
  const [historial, setHistorial] = useState(() => {
    const saved = localStorage.getItem('cupones_historial');
    return saved ? JSON.parse(saved) : [];
  });

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('quincenal');

  const [cuponSeleccionado, setCuponSeleccionado] = useState(null);
  const [solicitarMezcla, setSolicitarMezcla] = useState(false);
  const [solicitarRestaurar, setSolicitarRestaurar] = useState(false);
  const [verBanco, setVerBanco] = useState(false);
  const [verSettings, setVerSettings] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [cuponEditando, setCuponEditando] = useState(null);

  useEffect(() => {
    localStorage.setItem('cupones_citas', JSON.stringify(cupones));
  }, [cupones]);

  useEffect(() => {
    localStorage.setItem('sugerencias_activas', JSON.stringify(sugerenciasActivas));
  }, [sugerenciasActivas]);

  useEffect(() => {
    localStorage.setItem('cupones_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('cupones_historial', JSON.stringify(historial));
  }, [historial]);

  const registrarEvento = (tipo, detalle) => {
    const nuevoEvento = {
      id: Date.now(),
      fecha: new Date().toLocaleString(),
      tipo,
      detalle
    };
    setHistorial(prev => [nuevoEvento, ...prev]);
  };

  const agregarCupon = (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    if (cuponEditando) {
      setCupones(cupones.map(c => c.id === cuponEditando.id ? {
        ...c,
        titulo,
        descripcion,
        categoria
      } : c));
      registrarEvento('EDICIÓN', `Cupón modificado: "${titulo}"`);
      setCuponEditando(null);
    } else {
      const nuevo = {
        id: Date.now(),
        titulo,
        descripcion,
        categoria,
        fechaCreacion: new Date().toISOString(),
        usadoEnGolden: null
      };
      setCupones([...cupones, nuevo]);
      registrarEvento('CREACIÓN', `Nuevo cupón añadido al banco: "${titulo}" (${categoria})`);
    }

    setTitulo('');
    setDescripcion('');
    setCategoria('quincenal');
  };

  const iniciarEdicion = (cupon) => {
    setCuponEditando(cupon);
    setTitulo(cupon.titulo);
    setDescripcion(cupon.descripcion || '');
    setCategoria(cupon.categoria);
    setVerBanco(false);
  };

  const eliminarCupon = (id, tituloCupon) => {
    if (window.confirm('¿Seguro que deseas eliminar este cupón del banco?')) {
      setCupones(cupones.filter(c => c.id !== id));
      setSugerenciasActivas(sugerenciasActivas.filter(c => c.id !== id));
      registrarEvento('ELIMINACIÓN', `Cupón eliminado: "${tituloCupon}"`);
      if (cuponSeleccionado?.id === id) setCuponSeleccionado(null);
    }
  };

  const mezclarSugerencias = () => {
    const quincenales = cupones.filter(c => c.categoria === 'quincenal');
    const mensuales = cupones.filter(c => c.categoria === 'mensual');

    const ultimosGoldenUsados = historial
      .filter(h => h.tipo === 'CANJE_GOLDEN')
      .map(h => new Date(h.fecha).getTime());

    const ultimoGolden = ultimosGoldenUsados.length > 0 ? Math.max(...ultimosGoldenUsados) : 0;
    const diasDesdeUltimoGolden = (Date.now() - ultimoGolden) / (1000 * 60 * 60 * 24);
    const goldenDisponible = diasDesdeUltimoGolden >= config.cooldownGoldenDias;

    const goldenCandidates = cupones.filter(c => c.categoria === 'golden');

    const qShuffled = [...quincenales].sort(() => 0.5 - Math.random()).slice(0, config.maxQuincenal);
    const mShuffled = [...mensuales].sort(() => 0.5 - Math.random()).slice(0, config.maxMensual);
    const gShuffled = goldenDisponible ? [...goldenCandidates].sort(() => 0.5 - Math.random()).slice(0, config.maxGoldenVisibles) : [];

    const seleccionados = [...qShuffled, ...mShuffled, ...gShuffled];
    setSugerenciasActivas(seleccionados);
    setSolicitarMezcla(false);
    registrarEvento('SISTEMA', 'Nuevas sugerencias generadas aleatoriamente');
  };

  const canjearCupon = (cupon) => {
    if (cupon.categoria === 'golden') {
      registrarEvento('CANJE_GOLDEN', `✨ ¡CUPÓN GOLDEN CANJEADO!: "${cupon.titulo}"`);
    } else {
      registrarEvento('CANJE', `Cupón canjeado: "${cupon.titulo}" (${cupon.categoria})`);
    }
    setSugerenciasActivas(sugerenciasActivas.filter(c => c.id !== cupon.id));
    setCupones(cupones.filter(c => c.id !== cupon.id));
    setCuponSeleccionado(null);
    alert(`🎉 ¡Cupón "${cupon.titulo}" canjeado con éxito! ¡A disfrutar la cita!`);
  };

  const restaurarSugerencia = (cupon) => {
    setSugerenciasActivas(sugerenciasActivas.filter(c => c.id !== cupon.id));
    setCuponSeleccionado(null);
    registrarEvento('SISTEMA', `Cupón devuelto al banco: "${cupon.titulo}"`);
  };

  const exportarBackup = async () => {
    const dataBackup = {
      cupones,
      sugerenciasActivas,
      config,
      historial,
      fechaExportacion: new Date().toISOString()
    };

    const nombreArchivo = `cuponera_citas_backup_${Date.now()}.json`;
    const contenidoJson = JSON.stringify(dataBackup, null, 2);

    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([contenidoJson], nombreArchivo, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Respaldo Cuponera de Citas',
            files: [file]
          });
          registrarEvento('SISTEMA', 'Copia de seguridad compartida');
          return;
        }
      } catch (err) {
        console.log('Error compartiendo:', err);
      }
    }

    const blob = new Blob([contenidoJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    registrarEvento('SISTEMA', 'Copia de seguridad descargada');
  };

  const importarBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.cupones && data.config) {
          setCupones(data.cupones || []);
          setSugerenciasActivas(data.sugerenciasActivas || []);
          setConfig(data.config || config);
          setHistorial(data.historial || []);
          registrarEvento('SISTEMA', 'Restauración de copia de seguridad exitosa');
          alert('✅ ¡Datos e historial restaurados correctamente!');
        } else {
          alert('⚠️ El archivo no parece un respaldo válido de la Cuponera.');
        }
      } catch (err) {
        alert('❌ Error al leer el archivo de respaldo.');
      }
    };
    reader.readAsText(file);
  };

  const ultimosGoldenUsados = historial
    .filter(h => h.tipo === 'CANJE_GOLDEN')
    .map(h => new Date(h.fecha).getTime());

  const ultimoGolden = ultimosGoldenUsados.length > 0 ? Math.max(...ultimosGoldenUsados) : 0;
  const diasDesdeUltimoGolden = (Date.now() - ultimoGolden) / (1000 * 60 * 60 * 24);
  const diasParaGolden = Math.max(0, Math.ceil(config.cooldownGoldenDias - diasDesdeUltimoGolden));
  const goldenDisponible = diasParaGolden === 0;

  const listaMostrada = sugerenciasActivas;

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setVerHistorial(true)} style={styles.iconBtn}>📜 Historial</button>
          <h1 style={styles.title}>🎟️ Cuponera de Citas</h1>
          <button onClick={() => { setTempConfig(config); setVerSettings(true); }} style={styles.iconBtn}>⚙️ Ajustes</button>
        </div>
        <div style={styles.badgeGroup}>
          <span style={{ ...styles.badge, backgroundColor: '#e0e7ff', color: '#3730a3' }}>Banco: {cupones.length}</span>
          <span style={{ ...styles.badge, backgroundColor: '#fef3c7', color: '#92400e' }}>Golden: {cupones.filter(c => c.categoria === 'golden').length}</span>
        </div>
      </header>

      {/* CONTADORES */}
      <section style={styles.timerBar}>
        <div style={styles.timerBox}>
          <span style={styles.timerLabel}>⏱️ Próx. Mezcla:</span>
          <span style={styles.timerValue}>{diasParaGolden > 0 ? `${diasParaGolden} días` : '¡Lista!'}</span>
        </div>
        <div style={{ ...styles.timerBox, borderColor: goldenDisponible ? '#f59e0b' : '#e5e7eb' }}>
          <span style={styles.timerLabel}>🌟 Estado Golden:</span>
          <span style={{ ...styles.timerValue, color: goldenDisponible ? '#d97706' : '#6b7280' }}>
            {goldenDisponible ? '¡Disponible!' : `${diasParaGolden}d rest.`}
          </span>
        </div>
      </section>

      {/* CREAR / EDITAR */}
      <section style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={styles.sectionTitle}>{cuponEditando ? '✏️ Editando Cupón' : '➕ Crear Idea'}</h2>
          <button onClick={() => setVerBanco(true)} style={styles.linkBtn}>
            📚 Banco ({cupones.length})
          </button>
        </div>

        <form onSubmit={agregarCupon} style={{ marginTop: '10px' }}>
          <input
            type="text"
            placeholder="Título (ej: Picnic al atardecer)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={styles.input}
            required
          />
          <textarea
            placeholder="Detalles u opciones adicionales..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            style={styles.textarea}
          />

          <div style={styles.buttonGroup}>
            <button type="button" onClick={() => setCategoria('quincenal')} style={{ ...styles.catBtn, backgroundColor: categoria === 'quincenal' ? '#3b82f6' : '#e5e7eb', color: categoria === 'quincenal' ? '#fff' : '#000' }}>Quincenal</button>
            <button type="button" onClick={() => setCategoria('mensual')} style={{ ...styles.catBtn, backgroundColor: categoria === 'mensual' ? '#8b5cf6' : '#e5e7eb', color: categoria === 'mensual' ? '#fff' : '#000' }}>Mensual</button>
            <button type="button" onClick={() => setCategoria('golden')} style={{ ...styles.catBtn, backgroundColor: categoria === 'golden' ? '#f59e0b' : '#e5e7eb', color: categoria === 'golden' ? '#fff' : '#000' }}>✨ Golden</button>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button type="submit" style={styles.submitBtn}>
              {cuponEditando ? 'Guardar Cambios' : 'Añadir al Banco'}
            </button>
            {cuponEditando && (
              <button type="button" onClick={() => { setCuponEditando(null); setTitulo(''); setDescripcion(''); }} style={styles.cancelBtn}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* SUGERENCIAS */}
      <section style={{ marginTop: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={styles.sectionTitle}>🎯 Sugerencias Activas</h2>
          <button onClick={() => setSolicitarMezcla(true)} style={styles.actionBtn}>🎲 Mezclar</button>
        </div>

        {listaMostrada.length === 0 ? (
          <div style={styles.empty}>No hay sugerencias en pantalla. Toca "Mezclar" para seleccionar del banco.</div>
        ) : (
          <div style={styles.carousel}>
            {listaMostrada.map((c) => (
              <div key={c.id} onClick={() => setCuponSeleccionado(c)} style={{ ...styles.couponCard, borderColor: c.categoria === 'golden' ? '#f59e0b' : '#cbd5e1' }}>
                <span style={{ ...styles.tag, backgroundColor: c.categoria === 'golden' ? '#fef3c7' : '#f1f5f9' }}>{c.categoria.toUpperCase()}</span>
                <h3 style={styles.couponTitle}>{c.titulo}</h3>
                {c.descripcion && <p style={styles.couponDesc}>{c.descripcion}</p>}
                <div style={styles.tapToUse}>Toca para canjear 👆</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL DETALLE */}
      {cuponSeleccionado && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ marginTop: 0 }}>🎟️ {cuponSeleccionado.titulo}</h3>
            <p>{cuponSeleccionado.descripcion || 'Sin descripción adicional.'}</p>
            <p><strong>Categoría:</strong> {cuponSeleccionado.categoria}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
              <button onClick={() => canjearCupon(cuponSeleccionado)} style={styles.payBtn}>🎉 ¡Canjear Cita!</button>
              <button onClick={() => setSolicitarRestaurar(true)} style={styles.restoreBtn}>↩️ Devolver al Banco</button>
              <button onClick={() => setCuponSeleccionado(null)} style={styles.cancelBtn}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR MEZCLA */}
      {solicitarMezcla && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>🎲 ¿Generar nuevas sugerencias?</h3>
            <p>Se descartarán las opciones no usadas actualmente en pantalla.</p>
            <button onClick={mezclarSugerencias} style={styles.payBtn}>Sí, mezclar ahora</button>
            <button onClick={() => setSolicitarMezcla(false)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR RESTAURAR */}
      {solicitarRestaurar && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>↩️ ¿Devolver al banco?</h3>
            <p>Regresará este cupón a la lista general para futuras mezclas.</p>
            <button onClick={() => { restaurarSugerencia(cuponSeleccionado); setSolicitarRestaurar(false); }} style={styles.payBtn}>Confirmar</button>
            <button onClick={() => setSolicitarRestaurar(false)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* BANCO DE CUPONES */}
      {verBanco && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>📚 Banco de Cupones ({cupones.length})</h3>
              <button onClick={() => setVerBanco(false)} style={styles.cancelBtn}>Cerrar</button>
            </div>
            {cupones.length === 0 ? (
              <p>El banco está vacío. Agrega ideas arriba.</p>
            ) : (
              cupones.map(c => (
                <div key={c.id} style={styles.bancoItem}>
                  <div>
                    <strong>{c.titulo}</strong> ({c.categoria})
                    {c.descripcion && <div style={{ fontSize: '11px', color: '#666' }}>{c.descripcion}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => iniciarEdicion(c)} style={styles.iconBtn}>✏️</button>
                    <button onClick={() => eliminarCupon(c.id, c.titulo)} style={{ ...styles.iconBtn, color: 'red' }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* AJUSTES */}
      {verSettings && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>⚙️ Configuración del Sistema</h3>
            <div style={styles.settingField}>
              <label style={styles.settingLabel}>Máx. Quincenales en pantalla:</label>
              <input type="number" value={tempConfig.maxQuincenal} onChange={e => setTempConfig({ ...tempConfig, maxQuincenal: Number(e.target.value) })} style={styles.settingInput} />
            </div>
            <div style={styles.settingField}>
              <label style={styles.settingLabel}>Máx. Mensuales en pantalla:</label>
              <input type="number" value={tempConfig.maxMensual} onChange={e => setTempConfig({ ...tempConfig, maxMensual: Number(e.target.value) })} style={styles.settingInput} />
            </div>
            <div style={styles.settingField}>
              <label style={styles.settingLabel}>Días de espera entre Goldens:</label>
              <input type="number" value={tempConfig.cooldownGoldenDias} onChange={e => setTempConfig({ ...tempConfig, cooldownGoldenDias: Number(e.target.value) })} style={styles.settingInput} />
            </div>

            <hr style={{ margin: '15px 0' }} />
            <h4>📁 Copias de Seguridad</h4>
            <button onClick={exportarBackup} style={styles.backupBtn}>📤 Exportar / Compartir Respaldo</button>
            <label style={styles.importLabel}>
              📥 Importar Respaldo (.json)
              <input type="file" accept=".json" onChange={importarBackup} style={{ display: 'none' }} />
            </label>

            <button onClick={() => { setConfig(tempConfig); setVerSettings(false); alert('Ajustes guardados'); }} style={styles.payBtn}>Guardar Cambios</button>
            <button onClick={() => setVerSettings(false)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* HISTORIAL */}
      {verHistorial && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>📜 Historial de Eventos</h3>
              <button onClick={() => setVerHistorial(false)} style={styles.cancelBtn}>Cerrar</button>
            </div>
            {historial.length === 0 ? (
              <p>Sin actividad registrada.</p>
            ) : (
              historial.map(h => (
                <div key={h.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                  <div style={{ fontSize: '10px', color: '#888' }}>{h.fecha}</div>
                  <strong style={{ fontSize: '12px' }}>[{h.tipo}]</strong> {h.detalle}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PIE DE PÁGINA / FIRMA */}
      <footer style={styles.footer}>
        By Guía Gastronómica Costarricense
      </footer>
    </div>
  );
}

const styles = {
  container: { padding: '12px', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '98vh' },
  header: { borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' },
  title: { fontSize: '18px', margin: 0 },
  badgeGroup: { display: 'flex', gap: '6px', marginTop: '6px' },
  badge: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  timerBar: { display: 'flex', gap: '8px', margin: '12px 0' },
  timerBox: { flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' },
  timerLabel: { fontSize: '10px', display: 'block', color: '#6b7280' },
  timerValue: { fontSize: '12px', fontWeight: 'bold' },
  card: { padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fafafa' },
  sectionTitle: { fontSize: '14px', margin: 0 },
  input: { width: '100%', padding: '8px', marginBottom: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '8px', marginBottom: '6px', borderRadius: '4px', border: '1px solid #ccc', height: '50px', boxSizing: 'border-box' },
  buttonGroup: { display: 'flex', gap: '4px' },
  catBtn: { flex: 1, padding: '6px', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' },
  submitBtn: { flex: 1, padding: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' },
  actionBtn: { padding: '4px 8px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer' },
  carousel: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' },
  couponCard: { padding: '12px', border: '2px solid', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer' },
  couponTitle: { margin: '4px 0', fontSize: '14px' },
  couponDesc: { margin: 0, fontSize: '12px', color: '#475569' },
  tag: { fontSize: '9px', fontWeight: 'bold', padding: '2px 4px', borderRadius: '3px' },
  tapToUse: { fontSize: '10px', color: '#94a3b8', textAlign: 'right', marginTop: '4px' },
  empty: { padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 },
  modal: { backgroundColor: '#fff', width: '100%', maxWidth: '400px', borderRadius: '8px', padding: '16px', boxSizing: 'border-box' },
  payBtn: { width: '100%', padding: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', marginBottom: '6px' },
  cancelBtn: { width: '100%', padding: '8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px' },
  restoreBtn: { width: '100%', padding: '8px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', marginBottom: '6px' },
  bancoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' },
  iconBtn: { padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' },
  settingField: { marginBottom: '10px' },
  settingLabel: { fontSize: '11px', color: '#4b5563', display: 'block' },
  settingInput: { width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' },
  backupBtn: { width: '100%', padding: '8px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', marginBottom: '6px' },
  importLabel: { display: 'block', width: '100%', padding: '8px', backgroundColor: '#8b5cf6', color: '#fff', borderRadius: '4px', textAlign: 'center', marginBottom: '12px', boxSizing: 'border-box', cursor: 'pointer', fontSize: '13px' },
  footer: { textAlign: 'center', padding: '12px 0 4px 0', fontSize: '11px', color: '#94a3b8', marginTop: 'auto', fontWeight: '600' }
};
	
