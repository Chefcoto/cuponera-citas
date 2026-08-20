import React, { useState, useEffect } from 'react';

export default function App() {
  // --- ESTADOS Y PERSISTENCIA ---
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

  // Formulario y Modales
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('quincenal');
  
  const [cupenSeleccionado, setCupónSeleccionado] = useState(null);
  const [solicitarMezcla, setSolicitarMezcla] = useState(false);
  const [solicitarRestaurar, setSolicitarRestaurar] = useState(false);
  const [verBanco, setVerBanco] = useState(false);
  const [verSettings, setVerSettings] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [cupónEditando, setCupónEditando] = useState(null);

  // Guardar en localStorage
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

  useEffect(() => {
    if (sugerenciasActivas.length === 0 && cupones.length > 0) {
      generarNuevoLote();
    }
  }, [cupones]);

  const hoy = new Date();

  // --- REGISTRO DE HISTORIAL ---
  const registrarEvento = (tipo, detalle) => {
    const nuevoEvento = {
      id: Date.now(),
      fecha: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      tipo,
      detalle
    };
    setHistorial(prev => [nuevoEvento, ...prev]);
  };

  // --- EXPORTAR / IMPORTAR BACKUP (MENÚ NATIVO DE ANDROID) ---
  const exportarBackup = async () => {
    try {
      const dataBackup = {
        cupones,
        sugerenciasActivas,
        config,
        historial,
        fechaExportacion: new Date().toISOString()
      };
      
      const ahora = new Date();
      const fechaFormateada = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(2, '0')}-${String(ahora.getMinutes()).padStart(2, '0')}`;
      const nombreArchivo = `Respaldo_AppCuponera_${fechaFormateada}.json`;
      const contenidoJson = JSON.stringify(dataBackup, null, 2);

      // Usar Web Share API para desplegar el selector de carpetas / guardar archivo de Android
      if (navigator.share && navigator.canShare) {
        const blob = new Blob([contenidoJson], { type: 'application/json' });
        const file = new File([blob], nombreArchivo, { type: 'application/json' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Respaldo Cuponera de Citas',
            files: [file]
          });
          registrarEvento('SISTEMA', `Respaldo guardado/compartido: ${nombreArchivo}`);
          return;
        }
      }

      // Descarga directa tradicional si no soporta menú nativo
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(contenidoJson)}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', nombreArchivo);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      registrarEvento('SISTEMA', `Copia de seguridad descargada: ${nombreArchivo}`);
      alert(`✅ Respaldo generado: ${nombreArchivo}`);
    } catch (e) {
      alert('❌ Error al exportar la copia de seguridad.');
    }
  };

  const importarBackup = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          if (parsedData.cupones && parsedData.config) {
            setCupones(parsedData.cupones || []);
            setSugerenciasActivas(parsedData.sugerenciasActivas || []);
            setConfig(parsedData.config || config);
            setTempConfig(parsedData.config || config);
            setHistorial(parsedData.historial || []);
            setVerSettings(false);
            alert('¡Copia de seguridad restaurada con éxito!');
          } else {
            alert('El archivo seleccionado no tiene el formato correcto de la cuponera.');
          }
        } catch (error) {
          alert('Error al leer el archivo de respaldo. Asegúrate de que sea un archivo .json válido.');
        }
      };
    }
  };

  // --- CÁLCULOS Y REGLAS DE NEGOCIO ---
  const cuponesUsadosQuincena = cupones.filter(c => {
    if (!c.usado || c.categoria !== 'quincenal' || !c.fechaUso) return false;
    const f = new Date(c.fechaUso);
    const mismaQuincena = (f.getDate() <= 15 && hoy.getDate() <= 15) || (f.getDate() > 15 && hoy.getDate() > 15);
    return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear() && mismaQuincena;
  }).length;

  const cuponesUsadosMes = cupones.filter(c => {
    if (!c.usado || c.categoria !== 'mensual' || !c.fechaUso) return false;
    const f = new Date(c.fechaUso);
    return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
  }).length;

  const ultimoGoldenUsado = cupones
    .filter(c => c.categoria === 'golden' && c.usado && c.fechaUso)
    .sort((a, b) => new Date(b.fechaUso) - new Date(a.fechaUso))[0];

  let diasParaSiguienteGolden = 0;
  let goldenDisponible = true;

  if (ultimoGoldenUsado) {
    const fechaUso = new Date(ultimoGoldenUsado.fechaUso);
    const diferenciaMs = hoy - fechaUso;
    const diasTranscurridos = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
    if (diasTranscurridos < config.cooldownGoldenDias) {
      goldenDisponible = false;
      diasParaSiguienteGolden = config.cooldownGoldenDias - diasTranscurridos;
    }
  }

  const diaActual = hoy.getDate();
  const diasParaCambioSugerencias = diaActual <= 15 ? 16 - diaActual : (new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() - diaActual) + 1;

  const generarNuevoLote = () => {
    const disponiblesQ = cupones.filter(c => !c.usado && c.categoria === 'quincenal').sort(() => 0.5 - Math.random());
    const disponiblesM = cupones.filter(c => !c.usado && c.categoria === 'mensual').sort(() => 0.5 - Math.random());

    const seleccionQ = disponiblesQ.slice(0, config.maxQuincenal);
    const seleccionM = disponiblesM.slice(0, config.maxMensual);

    const nuevoLote = [...seleccionQ, ...seleccionM].sort(() => 0.5 - Math.random());
    setSugerenciasActivas(nuevoLote);
    setSolicitarMezcla(false);
    
    registrarEvento('APROBACIÓN', 'Pareja autorizó refrescar el carrusel de sugerencias');
  };

  const ejecutarRestauracionTotal = () => {
    setCupones(cupones.map(c => ({ ...c, usado: false, fechaUso: null })));
    setSolicitarRestaurar(false);
    setVerSettings(false);
    registrarEvento('APROBACIÓN', 'Pareja autorizó Restaurar Todo (Cupones y Golden Tickets re-habilitados)');
    alert('¡Todos los cupones y Golden Tickets han sido restaurados exitosamente!');
  };

  const ejecutarHardReset = () => {
    if (confirm('⚠️ ¿Estás COMPLETAMENTE seguro de hacer un HARD RESET? Se borrarán todas las ideas, el historial y las configuraciones.')) {
      localStorage.clear();
      setCupones([]);
      setSugerenciasActivas([]);
      setHistorial([]);
      const defaultConfig = {
        maxQuincenal: 4,
        maxMensual: 2,
        cooldownGoldenDias: 60,
        maxGoldenVisibles: 1
      };
      setConfig(defaultConfig);
      setTempConfig(defaultConfig);
      setVerSettings(false);
      alert('Aplicación reiniciada desde cero.');
    }
  };

  const abrirModalSettings = () => {
    setTempConfig(config);
    setVerSettings(true);
  };

  const guardarSettings = (e) => {
    e.preventDefault();
    const finalConfig = {
      maxQuincenal: Math.max(1, parseInt(tempConfig.maxQuincenal) || 1),
      maxMensual: Math.max(1, parseInt(tempConfig.maxMensual) || 1),
      cooldownGoldenDias: Math.max(1, parseInt(tempConfig.cooldownGoldenDias) || 1),
      maxGoldenVisibles: Math.max(1, parseInt(tempConfig.maxGoldenVisibles) || 1)
    };
    setConfig(finalConfig);
    setTempConfig(finalConfig);
    setVerSettings(false);
    registrarEvento('SISTEMA', 'Ajustes de configuración actualizados');
  };

  const agregarCupon = (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    if (cupónEditando) {
      setCupones(cupones.map(c => c.id === cupónEditando.id ? { ...c, titulo, descripcion, categoria } : c));
      registrarEvento('SISTEMA', `Idea editada: "${titulo}"`);
      setCupónEditando(null);
    } else {
      const nuevo = { id: Date.now(), titulo, descripcion, categoria, usado: false, fechaUso: null };
      setCupones([...cupones, nuevo]);
      registrarEvento('SISTEMA', `Nueva idea registrada: "${titulo}" (${categoria})`);
    }

    setTitulo('');
    setDescripcion('');
  };

  const eliminarCupon = (id) => {
    const c = cupones.find(item => item.id === id);
    if (confirm('¿Eliminar esta idea del banco?')) {
      setCupones(cupones.filter(item => item.id !== id));
      setSugerenciasActivas(sugerenciasActivas.filter(s => s.id !== id));
      if (c) registrarEvento('SISTEMA', `Idea eliminada: "${c.titulo}"`);
    }
  };

  const iniciarEdicion = (c) => {
    setCupónEditando(c);
    setTitulo(c.titulo);
    setDescripcion(c.descripcion || '');
    setCategoria(c.categoria);
    setVerBanco(false);
  };

  const canjearCupon = (id) => {
    const cupon = cupones.find(c => c.id === id);
    if (!cupon) return;

    if (cupon.categoria === 'quincenal' && cuponesUsadosQuincena >= config.maxQuincenal) {
      alert(`Límite quincenal alcanzado (máx ${config.maxQuincenal})`);
      return;
    }
    if (cupon.categoria === 'mensual' && cuponesUsadosMes >= config.maxMensual) {
      alert(`Límite mensual alcanzado (máx ${config.maxMensual})`);
      return;
    }
    if (cupon.categoria === 'golden' && !goldenDisponible) {
      alert(`El Golden Ticket aún está en período de espera. Faltan ${diasParaSiguienteGolden} días.`);
      return;
    }

    setCupones(cupones.map(c => c.id === id ? { ...c, usado: true, fechaUso: new Date().toISOString() } : c));
    setSugerenciasActivas(sugerenciasActivas.filter(c => c.id !== id));
    setCupónSeleccionado(null);
    registrarEvento('CANJE', `Pareja marcó como pagado: "${cupon.titulo}" (${cupon.categoria.toUpperCase()})`);
  };

  const listaMostrada = sugerenciasActivas.filter(s => {
    const real = cupones.find(c => c.id === s.id);
    return real && !real.usado;
  });

  const goldenTicketsList = cupones.filter(c => c.categoria === 'golden');

  return (
    <div style={styles.container}>
      {/* HEADER CON BOTONES DE ACCIÓN */}
      <header style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setVerHistorial(true)} style={styles.headerIconBtn} title="Historial">📜</button>
          <h1 style={styles.title}>🎟️ Cuponera de Citas</h1>
          <button onClick={abrirModalSettings} style={styles.headerIconBtn} title="Ajustes">⚙️</button>
        </div>
        <div style={styles.badgeGroup}>
          <span style={{ ...styles.badge, backgroundColor: '#e0e7ff', color: '#3730a3' }}>Quincenales: {cuponesUsadosQuincena}/{config.maxQuincenal}</span>
          <span style={{ ...styles.badge, backgroundColor: '#f3e8ff', color: '#6b21a8' }}>Mensuales: {cuponesUsadosMes}/{config.maxMensual}</span>
        </div>
      </header>

      {/* CONTADORES REGRESIVOS */}
      <section style={styles.timerBar}>
        <div style={styles.timerBox}>
          <span style={styles.timerLabel}>⏱️ Próx. Cambio Sugerencias</span>
          <span style={styles.timerValue}>{diasParaCambioSugerencias} días</span>
        </div>
        <div style={{ ...styles.timerBox, borderColor: goldenDisponible ? '#f59e0b' : '#cccccc' }}>
          <span style={styles.timerLabel}>🌟 Estado Golden Ticket</span>
          <span style={{ ...styles.timerValue, color: goldenDisponible ? '#d97706' : '#666666' }}>
            {goldenDisponible ? '¡Disponible!' : `Espera: ${diasParaSiguienteGolden}d`}
          </span>
        </div>
      </section>

      {/* REGISTRO DE NUEVA IDEA */}
      <section style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={styles.sectionTitle}>{cupónEditando ? '✏️ Editando Idea' : 'Registrar Nueva Idea'}</h2>
          <button onClick={() => setVerBanco(true)} style={styles.bancoBtn}>
            📚 Banco ({cupones.length})
          </button>
        </div>

        <form onSubmit={agregarCupon} style={styles.form}>
          <input type="text" placeholder="Título (ej. Escapada, Masaje...)" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required />
          <textarea placeholder="Detalles u opciones..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ ...styles.input, height: '45px', resize: 'none' }} />
          
          <div style={styles.buttonGroup}>
            <button type="button" onClick={() => setCategoria('quincenal')} style={{...styles.categoryBtn, backgroundColor: categoria === 'quincenal' ? '#ec4899' : '#f0f0f0', color: categoria === 'quincenal' ? '#ffffff' : '#000000'}}>Quincenal</button>
            <button type="button" onClick={() => setCategoria('mensual')} style={{...styles.categoryBtn, backgroundColor: categoria === 'mensual' ? '#a855f7' : '#f0f0f0', color: categoria === 'mensual' ? '#ffffff' : '#000000'}}>Mensual</button>
            <button type="button" onClick={() => setCategoria('golden')} style={{...styles.categoryBtn, backgroundColor: categoria === 'golden' ? '#f59e0b' : '#f0f0f0', color: categoria === 'golden' ? '#ffffff' : '#000000'}}>✨ Golden</button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="submit" style={styles.submitBtn}>
              {cupónEditando ? 'Guardar Cambios' : 'Guardar en Banco'}
            </button>
            {cupónEditando && (
              <button type="button" onClick={() => { setCupónEditando(null); setTitulo(''); setDescripcion(''); }} style={styles.cancelBtn}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* SUGERENCIAS ACTIVAS */}
      <section style={{ marginTop: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={styles.sectionTitle}>🎯 Sugerencias Activas ({listaMostrada.length})</h2>
          <button onClick={() => setSolicitarMezcla(true)} style={styles.shuffleBtn}>🔄 Cambiar Opciones</button>
        </div>

        {listaMostrada.length === 0 ? (
          <div style={styles.empty}>No hay sugerencias fijadas. ¡Presiona "Cambiar Opciones" o agrega ideas!</div>
        ) : (
          <div style={styles.carousel}>
            {listaMostrada.map((c) => (
              <div key={c.id} onClick={() => setCupónSeleccionado(c)} style={styles.couponCard}>
                <span style={{ ...styles.tag, backgroundColor: c.categoria === 'quincenal' ? '#fce7f3' : '#f3e8ff', color: c.categoria === 'quincenal' ? '#be185d' : '#6b21a8' }}>{c.categoria}</span>
                <h3 style={styles.couponTitle}>{c.titulo}</h3>
                {c.descripcion && <p style={styles.couponDesc}>{c.descripcion}</p>}
                <div style={styles.tapToUse}>Toca para presentar →</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECCIÓN GOLDEN TICKETS */}
      <section style={{ marginTop: '20px' }}>
        <h2 style={{ ...styles.sectionTitle, color: '#b45309' }}>👑 Golden Tickets (Especiales)</h2>
        {goldenTicketsList.length === 0 ? (
          <div style={styles.emptyGolden}>No has registrado ningún Golden Ticket. ¡Crea uno especial arriba!</div>
        ) : (
          <div style={styles.carousel}>
            {goldenTicketsList.map((c) => {
              const estaDisponible = !c.usado && goldenDisponible;
              return (
                <div 
                  key={c.id} 
                  onClick={() => estaDisponible && setCupónSeleccionado(c)} 
                  style={{
                    ...styles.goldenCard,
                    ...(estaDisponible ? styles.goldenActive : styles.goldenDisabled)
                  }}
                >
                  <div>
                    <span style={styles.goldenTag}>✨ GOLDEN TICKET</span>
                    <h3 style={styles.goldenTitle}>{c.titulo}</h3>
                    {c.descripcion && <p style={styles.goldenDesc}>{c.descripcion}</p>}
                  </div>
                  <div style={styles.goldenFooter}>
                    {c.usado ? '❌ YA CANJEADO' : (!goldenDisponible ? `⏳ ESPERA (${diasParaSiguienteGolden}d)` : '✨ TOCAR PARA USAR')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL 1: Canje de Cupón */}
      {cupenSeleccionado && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: cupenSeleccionado.categoria === 'golden' ? '#d97706' : '#ec4899' }}>
              {cupenSeleccionado.categoria === 'golden' ? '✨ GOLDEN TICKET PRESENTADO' : 'CUPÓN PRESENTADO'}
            </span>
            <h3 style={{ fontSize: '20px', margin: '10px 0', color: '#000000' }}>{cupenSeleccionado.titulo}</h3>
            {cupenSeleccionado.descripcion && <p style={{ fontSize: '12px', color: '#333333', background: '#f9f9f9', padding: '8px', borderRadius: '8px' }}>{cupenSeleccionado.descripcion}</p>}
            <p style={{ fontSize: '11px', color: '#555555', margin: '15px 0 10px 0' }}>Entrégale el teléfono a tu pareja para confirmar el pago.</p>
            <button onClick={() => canjearCupon(cupenSeleccionado.id)} style={{ ...styles.payBtn, backgroundColor: cupenSeleccionado.categoria === 'golden' ? '#d97706' : '#10b981' }}>
              ✓ Marcar como Pagado
            </button>
            <button onClick={() => setCupónSeleccionado(null)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL 2: Autorización para Cambiar Lote */}
      {solicitarMezcla && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a855f7' }}>AUTORIZACIÓN DE PAREJA</span>
            <h3 style={{ fontSize: '18px', margin: '10px 0', color: '#000000' }}>¿Cambiar sugerencias?</h3>
            <p style={{ fontSize: '12px', color: '#333333', background: '#f3e8ff', padding: '10px', borderRadius: '8px' }}>
              Se seleccionarán aleatoriamente hasta <b>{config.maxQuincenal} quincenales</b> y <b>{config.maxMensual} mensuales</b> de tu banco.
            </p>
            <p style={{ fontSize: '11px', color: '#555555', margin: '15px 0 10px 0' }}>Tu pareja debe presionar para autorizar la mezcla.</p>
            <button onClick={generarNuevoLote} style={{ ...styles.payBtn, backgroundColor: '#a855f7' }}>
              🔑 Pareja Autoriza Cambiar
            </button>
            <button onClick={() => setSolicitarMezcla(false)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL 3: Gestor del Banco de Ideas */}
      {verBanco && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '340px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '16px', color: '#000000', margin: '0 0 10px 0' }}>📚 Banco de Ideas Registradas</h3>
            
            {cupones.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#555555' }}>No hay ideas en el banco.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                {cupones.map(c => (
                  <div key={c.id} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ccc', background: c.usado ? '#f9fafb' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', backgroundColor: c.categoria === 'quincenal' ? '#fce7f3' : (c.categoria === 'mensual' ? '#f3e8ff' : '#fef3c7'), color: c.categoria === 'quincenal' ? '#be185d' : (c.categoria === 'mensual' ? '#6b21a8' : '#b45309') }}>
                        {c.categoria} {c.usado ? '(USADO)' : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => iniciarEdicion(c)} style={styles.iconBtn}>✏️</button>
                        <button onClick={() => eliminarCupon(c.id)} style={{ ...styles.iconBtn, backgroundColor: '#fee2e2' }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px', color: '#000000' }}>{c.titulo}</div>
                    {c.descripcion && <div style={{ fontSize: '11px', color: '#555555' }}>{c.descripcion}</div>}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setVerBanco(false)} style={{ ...styles.cancelBtn, marginTop: '15px' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: PANEL DE SETTINGS / CONFIGURACIÓN + BACKUPS */}
      {verSettings && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '320px', textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '16px', color: '#000000', margin: '0 0 12px 0', textAlign: 'center' }}>⚙️ Ajustes y Configuración</h3>
            
            <form onSubmit={guardarSettings}>
              <div style={styles.settingField}>
                <label style={styles.settingLabel}>Máx. Cupones Quincenales:</label>
                <input 
                  type="number" min="1" max="20" 
                  value={tempConfig.maxQuincenal} 
                  onChange={(e) => setTempConfig({ ...tempConfig, maxQuincenal: e.target.value })} 
                  style={styles.settingInput}
                  required
                />
              </div>

              <div style={styles.settingField}>
                <label style={styles.settingLabel}>Máx. Cupones Mensuales:</label>
                <input 
                  type="number" min="1" max="20" 
                  value={tempConfig.maxMensual} 
                  onChange={(e) => setTempConfig({ ...tempConfig, maxMensual: e.target.value })} 
                  style={styles.settingInput}
                  required
                />
              </div>

              <div style={styles.settingField}>
                <label style={styles.settingLabel}>Días espera Golden Ticket:</label>
                <input 
                  type="number" min="1" max="365" 
                  value={tempConfig.cooldownGoldenDias} 
                  onChange={(e) => setTempConfig({ ...tempConfig, cooldownGoldenDias: e.target.value })} 
                  style={styles.settingInput}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                <button type="submit" style={{ ...styles.payBtn, backgroundColor: '#10b981', margin: 0 }}>
                  💾 Guardar Configuración
                </button>
                <button type="button" onClick={() => setVerSettings(false)} style={{ ...styles.cancelBtn, width: 'auto' }}>
                  Cancelar
                </button>
              </div>
            </form>

            <hr style={{ border: '0.5px solid #ccc', margin: '15px 0' }} />

            {/* SECCIÓN COPIAS DE SEGURIDAD / BACKUPS */}
            <h4 style={{ fontSize: '12px', color: '#000000', margin: '0 0 8px 0' }}>💾 Copias de Seguridad (Backup)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button type="button" onClick={exportarBackup} style={styles.backupBtn}>
                📤 Exportar Copia de Seguridad (.json)
              </button>

              <label style={styles.importLabel}>
                📥 Importar Archivo de Respaldo
                <input type="file" accept=".json" onChange={importarBackup} style={{ display: 'none' }} />
              </label>
            </div>

            <hr style={{ border: '0.5px solid #ccc', margin: '15px 0' }} />

            {/* BOTONES ESPECIALES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" onClick={() => { setVerSettings(false); setSolicitarRestaurar(true); }} style={styles.restoreBtn}>
                🔄 Restaurar Uso de Cupones (Requiere Pareja)
              </button>

              <button type="button" onClick={ejecutarHardReset} style={styles.hardResetBtn}>
                💥 Hard Reset (Borrar Todo de Fábrica)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: APROBACIÓN DE PAREJA PARA RESTAURAR TODO */}
      {solicitarRestaurar && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#db2777' }}>APROBACIÓN DE PAREJA</span>
            <h3 style={{ fontSize: '18px', margin: '10px 0', color: '#000000' }}>¿Restaurar estado de cupones?</h3>
            <p style={{ fontSize: '12px', color: '#333333', background: '#fdf2f8', padding: '10px', borderRadius: '8px' }}>
              Esto volverá a <b>activar todos los cupones canjeados</b> y reiniciará el contador del <b>Golden Ticket</b>. Las ideas del banco no se borrarán.
            </p>
            <p style={{ fontSize: '11px', color: '#555555', margin: '15px 0 10px 0' }}>Tu pareja debe presionar el botón para confirmar la restauración.</p>
            <button onClick={ejecutarRestauracionTotal} style={{ ...styles.payBtn, backgroundColor: '#db2777' }}>
              🔑 Pareja Autoriza Restaurar Todo
            </button>
            <button onClick={() => setSolicitarRestaurar(false)} style={styles.cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL 6: HISTORIAL DE ACTIVIDAD */}
      {verHistorial && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '340px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '16px', color: '#000000', margin: '0 0 10px 0' }}>📜 Historial de Actividad</h3>
            
            {historial.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#555555' }}>No hay registros de actividad aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                {historial.map(h => (
                  <div key={h.id} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc', background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666666', fontWeight: 'bold' }}>
                      <span>{h.tipo}</span>
                      <span>{h.fecha}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#000000', marginTop: '2px' }}>
                      {h.detalle}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setVerHistorial(false)} style={{ ...styles.cancelBtn, marginTop: '15px' }}>
              Cerrar Historial
            </button>
          </div>
        </div>
      )}

      {/* PIE DE PÁGINA */}
      <footer style={styles.footer}>
        By Guía Gastronómica Costarricense
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'system-ui, sans-serif',
    padding: '15px',
    backgroundColor: '#ffffff',
    color: '#000000',
    minHeight: '98vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column'
  },
  header: { textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '8px' },
  title: { margin: 0, color: '#000000', fontSize: '20px' },
  headerIconBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px' },
  badgeGroup: { display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '6px' },
  badge: { fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' },
  
  timerBar: { display: 'flex', gap: '8px', marginBottom: '12px' },
  timerBox: { flex: 1, backgroundColor: '#ffffff', padding: '8px', borderRadius: '12px', border: '1px solid #cccccc', textAlign: 'center', display: 'flex', flexDirection: 'column' },
  timerLabel: { fontSize: '9px', color: '#555555', textTransform: 'uppercase', fontWeight: 'bold' },
  timerValue: { fontSize: '12px', fontWeight: 'bold', color: '#000000', marginTop: '2px' },

  card: { backgroundColor: '#ffffff', padding: '15px', borderRadius: '16px', border: '1px solid #cccccc' },
  sectionTitle: { fontSize: '11px', color: '#000000', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 },
  bancoBtn: { backgroundColor: '#e0e7ff', border: 'none', color: '#3730a3', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  shuffleBtn: { backgroundColor: '#e0e7ff', border: 'none', color: '#3730a3', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #cccccc', fontSize: '13px', outline: 'none', backgroundColor: '#ffffff', color: '#000000' },
  buttonGroup: { display: 'flex', gap: '6px' },
  categoryBtn: { flex: 1, padding: '8px 4px', border: '1px solid #cccccc', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  submitBtn: { flex: 1, padding: '10px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '20px', color: '#555555', backgroundColor: '#ffffff', borderRadius: '16px', fontSize: '12px', border: '1px solid #cccccc' },
  emptyGolden: { textAlign: 'center', padding: '20px', color: '#92400e', backgroundColor: '#fef3c7', borderRadius: '16px', fontSize: '12px', border: '1px dashed #f59e0b' },
  carousel: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginTop: '8px' },
  couponCard: { minWidth: '180px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '16px', border: '1px solid #cccccc', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  tag: { fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start' },
  couponTitle: { margin: '8px 0 4px 0', fontSize: '15px', color: '#000000' },
  couponDesc: { fontSize: '11px', color: '#333333', margin: 0 },
  tapToUse: { fontSize: '10px', color: '#555555', fontWeight: 'bold', marginTop: '10px', textAlign: 'right' },
  
  goldenCard: { minWidth: '200px', padding: '14px', borderRadius: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid #fbbf24' },
  goldenActive: { background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', cursor: 'pointer' },
  goldenDisabled: { background: '#f3f4f6', borderColor: '#d1d5db', opacity: 0.6, cursor: 'not-allowed' },
  goldenTag: { fontSize: '9px', fontWeight: '900', color: '#b45309', letterSpacing: '1px' },
  goldenTitle: { margin: '6px 0 4px 0', fontSize: '16px', color: '#78350f', fontWeight: '800' },
  goldenDesc: { fontSize: '11px', color: '#92400e', margin: 0 },
  goldenFooter: { fontSize: '10px', fontWeight: 'bold', color: '#b45309', marginTop: '12px', textAlign: 'right' },

  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px', zIndex: 100 },
  modal: { backgroundColor: '#ffffff', width: '100%', maxWidth: '300px', borderRadius: '20px', padding: '20px', textAlign: 'center', color: '#000000' },
  payBtn: { width: '100%', padding: '12px', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginBottom: '6px' },
  cancelBtn: { width: '100%', padding: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '11px', cursor: 'pointer' },
  restoreBtn: { width: '100%', padding: '10px', backgroundColor: '#64748b', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' },
  hardResetBtn: { width: '100%', padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' },
  backupBtn: { width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', textAlign: 'center' },
  importLabel: { display: 'block', width: '100%', padding: '10px', backgroundColor: '#8b5cf6', color: '#ffffff', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' },
  iconBtn: { padding: '4px 6px', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', backgroundColor: '#f3f4f6' },

  settingField: { marginBottom: '10px' },
  settingLabel: { fontSize: '11px', color: '#333333', fontWeight: 'bold', display: 'block', marginBottom: '3px' },
  settingInput: { width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #cccccc', fontSize: '12px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000' },
  footer: { textAlign: 'center', padding: '16px 0 8px 0', fontSize: '11px', color: '#555555', marginTop: 'auto', fontWeight: '600' }
};

