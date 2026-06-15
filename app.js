const { useState, useEffect, useCallback, useMemo } = React;

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n) => 'L ' + (Number(n) || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-HN', { day: '2-digit', month: 'short' });
};
const uid = () => Math.random().toString(36).slice(2, 10);

const CATS = ['Bebidas', 'Snacks', 'Abarrotes', 'Limpieza', 'Otros'];
const ROW_ID = 'main';
const EMPTY_DATA = { productos: [], fiados: [], ventas: [], clientes: [] };

const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// ============================================================
// STORE: Supabase-backed shared state with polling sync
// ============================================================
function useStore() {
  const [data, setDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: rows, error: err } = await supabase
        .from('pulperia_data')
        .select('data')
        .eq('id', ROW_ID)
        .single();
      if (err) throw err;
      setDataState(rows && rows.data ? rows.data : EMPTY_DATA);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('No se pudo conectar a la base de datos. Revisa tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15s so other phones' changes show up without manual refresh
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const save = useCallback(async (next) => {
    setDataState(next);
    setSyncing(true);
    try {
      const { error: err } = await supabase
        .from('pulperia_data')
        .update({ data: next, updated_at: new Date().toISOString() })
        .eq('id', ROW_ID);
      if (err) throw err;
      setError(null);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
      setSyncing(false);
    }
  }, []);

  return { data, setData: save, loading, error, syncing, reload: load };
}

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: 'ti-home' },
  { id: 'ventas', label: 'Ventas', icon: 'ti-cash' },
  { id: 'inventario', label: 'Inventario', icon: 'ti-package' },
  { id: 'fiados', label: 'Fiados', icon: 'ti-notebook' },
];

function App() {
  const { data, setData, loading, error, syncing, reload } = useStore();
  const [tab, setTab] = useState('inicio');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.ball} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 12 }}>Cargando datos de la pulpería...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.loadingWrap}>
        <i className="ti ti-wifi-off" style={{ fontSize: 32, color: 'var(--color-text-danger)' }} aria-hidden="true" />
        <p style={{ color: 'var(--color-text-danger)', fontSize: 14, marginTop: 12, textAlign: 'center', padding: '0 1.5rem' }}>{error}</p>
        <button style={{ ...styles.secondaryBtn, width: 'auto', marginTop: 12, padding: '0 16px' }} onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoMark}>
            <i className="ti ti-bottle" style={{ fontSize: 20 }} aria-hidden="true" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>Pulpería del Gol</h1>
            <p style={styles.subtitle}>{new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          {syncing && <i className="ti ti-refresh" style={{ fontSize: 16, color: 'var(--color-text-success)', opacity: 0.8 }} aria-hidden="true" />}
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginRight: 6 }} aria-hidden="true" />
          {error}
        </div>
      )}

      <main style={styles.main}>
        {tab === 'inicio' && <Inicio data={data} setData={setData} showToast={showToast} setTab={setTab} />}
        {tab === 'ventas' && <Ventas data={data} setData={setData} showToast={showToast} />}
        {tab === 'inventario' && <Inventario data={data} setData={setData} showToast={showToast} />}
        {tab === 'fiados' && <Fiados data={data} setData={setData} showToast={showToast} />}
      </main>

      <nav style={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnActive : {}) }}
            aria-current={tab === t.id}
          >
            <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} aria-hidden="true" />
            <span style={styles.navLabel}>{t.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div style={styles.toast} role="status">
          <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// INICIO / DASHBOARD
// ============================================================
function Inicio({ data, setData, showToast, setTab }) {
  const today = todayStr();
  const ventaHoy = data.ventas.find((v) => v.fecha === today);

  const totales = useMemo(() => {
    const valorInventario = data.productos.reduce((acc, p) => acc + (Number(p.costo) || 0) * (Number(p.cantidad) || 0), 0);
    const saldoFiados = data.fiados.reduce((acc, f) => acc + ((Number(f.monto) || 0) - (Number(f.pagado) || 0)), 0);
    const bajaRotacion = data.productos.filter((p) => {
      if (!p.ultimaVenta) return false;
      const dias = (new Date() - new Date(p.ultimaVenta + 'T00:00:00')) / 86400000;
      return dias > 30;
    }).length;

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const v = data.ventas.find((x) => x.fecha === ds);
      last7.push({ fecha: ds, total: v ? v.totalVendido : null });
    }
    const semanaTotal = last7.reduce((a, b) => a + (b.total || 0), 0);

    return { valorInventario, saldoFiados, bajaRotacion, last7, semanaTotal };
  }, [data]);

  const maxVenta = Math.max(1, ...totales.last7.map((d) => d.total || 0));

  return (
    <div style={styles.screen}>
      <section style={styles.heroCard}>
        <p style={styles.heroLabel}>Venta de hoy</p>
        {ventaHoy ? (
          <p style={styles.heroValue}>{fmtMoney(ventaHoy.totalVendido)}</p>
        ) : (
          <React.Fragment>
            <p style={styles.heroValue}>—</p>
            <p style={styles.heroHint}>Aún no se ha registrado el cierre de hoy</p>
          </React.Fragment>
        )}
        <button style={styles.heroBtn} onClick={() => setTab('ventas')}>
          {ventaHoy ? 'Ver detalle' : 'Registrar venta de hoy'}
          <i className="ti ti-arrow-right" style={{ fontSize: 16, marginLeft: 6 }} aria-hidden="true" />
        </button>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Esta semana</p>
          <p style={styles.statValue}>{fmtMoney(totales.semanaTotal)}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Fiado pendiente</p>
          <p style={{ ...styles.statValue, color: totales.saldoFiados > 0 ? 'var(--color-text-warning)' : 'var(--color-text-primary)' }}>
            {fmtMoney(totales.saldoFiados)}
          </p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Valor en stock</p>
          <p style={styles.statValue}>{fmtMoney(totales.valorInventario)}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Rotación baja</p>
          <p style={{ ...styles.statValue, color: totales.bajaRotacion > 0 ? 'var(--color-text-warning)' : 'var(--color-text-primary)' }}>
            {totales.bajaRotacion} {totales.bajaRotacion === 1 ? 'producto' : 'productos'}
          </p>
        </div>
      </section>

      <section style={styles.card}>
        <p style={styles.cardTitle}>Últimos 7 días</p>
        <div style={styles.chartRow}>
          {totales.last7.map((d) => {
            const h = d.total ? Math.max(6, (d.total / maxVenta) * 80) : 0;
            const isToday = d.fecha === today;
            return (
              <div key={d.fecha} style={styles.chartCol}>
                <div style={styles.chartBarWrap}>
                  {d.total ? (
                    <div
                      style={{
                        ...styles.chartBar,
                        height: `${h}px`,
                        background: isToday ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                        borderColor: isToday ? 'var(--color-border-info)' : 'var(--color-border-tertiary)',
                      }}
                      title={fmtMoney(d.total)}
                    />
                  ) : (
                    <div style={{ ...styles.chartBar, height: '4px', background: 'var(--color-background-secondary)', opacity: 0.4 }} />
                  )}
                </div>
                <span style={styles.chartLabel}>{fmtDate(d.fecha).split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {totales.bajaRotacion > 0 && (
        <section style={{ ...styles.card, borderColor: 'var(--color-border-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: 'var(--color-text-warning)' }} aria-hidden="true" />
            <p style={{ ...styles.cardTitle, margin: 0 }}>Productos sin movimiento</p>
          </div>
          <p style={styles.mutedText}>
            {totales.bajaRotacion} {totales.bajaRotacion === 1 ? 'producto lleva' : 'productos llevan'} más de 30 días sin venderse. Revisa si conviene dejar de comprarlos.
          </p>
          <button style={styles.linkBtn} onClick={() => setTab('inventario')}>
            Ver inventario <i className="ti ti-arrow-right" style={{ fontSize: 14 }} aria-hidden="true" />
          </button>
        </section>
      )}
    </div>
  );
}

// ============================================================
// VENTAS (arqueo de caja)
// ============================================================
function Ventas({ data, setData, showToast }) {
  const today = todayStr();
  const [fecha, setFecha] = useState(today);

  const ventaExistente = data.ventas.find((v) => v.fecha === fecha);
  const [fondo, setFondo] = useState('');
  const [efectivoFinal, setEfectivoFinal] = useState('');
  const [gastos, setGastos] = useState('');
  const [fiadosCobrados, setFiadosCobrados] = useState('');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (ventaExistente) {
      setFondo(String(ventaExistente.fondo ?? ''));
      setEfectivoFinal(String(ventaExistente.efectivoFinal ?? ''));
      setGastos(String(ventaExistente.gastos ?? ''));
      setFiadosCobrados(String(ventaExistente.fiadosCobrados ?? ''));
      setNota(ventaExistente.nota ?? '');
    } else {
      const prev = [...data.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      setFondo(prev ? String(prev.efectivoFinal ?? '') : '');
      setEfectivoFinal('');
      setGastos('');
      setFiadosCobrados('');
      setNota('');
    }
  }, [fecha, ventaExistente, data.ventas]);

  const totalVendido = useMemo(() => {
    const f = Number(fondo) || 0;
    const e = Number(efectivoFinal) || 0;
    const g = Number(gastos) || 0;
    const fc = Number(fiadosCobrados) || 0;
    return e - f + g - fc;
  }, [fondo, efectivoFinal, gastos, fiadosCobrados]);

  const guardar = () => {
    if (efectivoFinal === '') {
      showToast('Falta el efectivo final');
      return;
    }
    const nuevaVenta = {
      fecha,
      fondo: Number(fondo) || 0,
      efectivoFinal: Number(efectivoFinal) || 0,
      gastos: Number(gastos) || 0,
      fiadosCobrados: Number(fiadosCobrados) || 0,
      totalVendido,
      nota,
    };
    const ventas = data.ventas.filter((v) => v.fecha !== fecha);
    ventas.push(nuevaVenta);
    ventas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    setData({ ...data, ventas });
    showToast('Venta guardada');
  };

  const last7 = useMemo(() => {
    return [...data.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 7);
  }, [data.ventas]);

  const semanaTotal = last7.reduce((a, v) => a + (v.totalVendido || 0), 0);
  const promedio = last7.length ? semanaTotal / last7.length : 0;

  return (
    <div style={styles.screen}>
      <section style={styles.card}>
        <p style={styles.cardTitle}>Cierre de caja</p>
        <p style={styles.mutedText}>Cuenta el efectivo al abrir y al cerrar. No necesitas anotar cada venta.</p>

        <Field label="Fecha">
          <input type="date" value={fecha} max={today} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        <Field label="Fondo inicial (con lo que abrieron hoy)">
          <MoneyInput value={fondo} onChange={setFondo} />
        </Field>

        <Field label="Efectivo al cerrar (todo lo que hay en caja)">
          <MoneyInput value={efectivoFinal} onChange={setEfectivoFinal} />
        </Field>

        <Field label="Gastos pagados desde la caja (opcional)" hint="Ej: compraron hielo, pagaron un mandado">
          <MoneyInput value={gastos} onChange={setGastos} />
        </Field>

        <Field label="Fiados cobrados hoy en efectivo (opcional)" hint="Para que no se cuente como venta nueva">
          <MoneyInput value={fiadosCobrados} onChange={setFiadosCobrados} />
        </Field>

        <Field label="Nota (opcional)">
          <input type="text" placeholder="Ej: día de partido, mucha gente" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Field>

        <div style={styles.resultBox}>
          <span style={styles.resultLabel}>Total vendido</span>
          <span style={{ ...styles.resultValue, color: totalVendido < 0 ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>
            {fmtMoney(totalVendido)}
          </span>
        </div>
        {totalVendido < 0 && (
          <p style={{ ...styles.mutedText, color: 'var(--color-text-danger)' }}>
            El total salió negativo. Revisa los números — puede que falte dinero o algo esté mal anotado.
          </p>
        )}

        <button style={styles.primaryBtn} onClick={guardar}>
          <i className="ti ti-device-floppy" style={{ fontSize: 16, marginRight: 6 }} aria-hidden="true" />
          {ventaExistente ? 'Actualizar' : 'Guardar cierre'}
        </button>
      </section>

      <section style={styles.card}>
        <p style={styles.cardTitle}>Resumen reciente</p>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Últimos {last7.length || 0} días</p>
            <p style={styles.statValue}>{fmtMoney(semanaTotal)}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Promedio diario</p>
            <p style={styles.statValue}>{fmtMoney(promedio)}</p>
          </div>
        </div>

        {last7.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {last7.map((v) => (
              <div key={v.fecha} style={styles.listRow}>
                <div>
                  <p style={styles.listTitle}>{fmtDate(v.fecha)}</p>
                  {v.nota && <p style={styles.listSub}>{v.nota}</p>}
                </div>
                <p style={{ ...styles.listAmount, color: v.totalVendido < 0 ? 'var(--color-text-danger)' : 'var(--color-text-primary)' }}>
                  {fmtMoney(v.totalVendido)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// INVENTARIO
// ============================================================
function Inventario({ data, setData, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');

  const productos = useMemo(() => {
    let list = [...data.productos];
    if (filter !== 'Todos') list = list.filter((p) => p.categoria === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(s));
    }
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [data.productos, filter, search]);

  const startNew = () => {
    setEditing({ id: uid(), nombre: '', categoria: 'Bebidas', costo: '', precio: '', cantidad: '', ultimaVenta: '' });
    setShowForm(true);
  };

  const startEdit = (p) => {
    setEditing({ ...p, costo: String(p.costo ?? ''), precio: String(p.precio ?? ''), cantidad: String(p.cantidad ?? '') });
    setShowForm(true);
  };

  const guardarProducto = () => {
    if (!editing.nombre.trim()) {
      showToast('Falta el nombre');
      return;
    }
    const limpio = {
      ...editing,
      costo: Number(editing.costo) || 0,
      precio: Number(editing.precio) || 0,
      cantidad: Number(editing.cantidad) || 0,
    };
    const productos = data.productos.filter((p) => p.id !== limpio.id);
    productos.push(limpio);
    setData({ ...data, productos });
    setShowForm(false);
    setEditing(null);
    showToast('Producto guardado');
  };

  const eliminar = (id) => {
    setData({ ...data, productos: data.productos.filter((p) => p.id !== id) });
    showToast('Producto eliminado');
  };

  const venderUno = (p) => {
    const cantidad = Math.max(0, (Number(p.cantidad) || 0) - 1);
    const productos = data.productos.map((x) => (x.id === p.id ? { ...x, cantidad, ultimaVenta: todayStr() } : x));
    setData({ ...data, productos });
  };

  const totalStock = data.productos.reduce((acc, p) => acc + (Number(p.costo) || 0) * (Number(p.cantidad) || 0), 0);

  return (
    <div style={styles.screen}>
      <section style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p style={styles.cardTitle}>Productos</p>
          <p style={styles.mutedText}>{fmtMoney(totalStock)} en stock</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div style={styles.chipRow}>
          {['Todos', ...CATS].map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{ ...styles.chip, ...(filter === c ? styles.chipActive : {}) }}
            >
              {c}
            </button>
          ))}
        </div>

        <button style={{ ...styles.primaryBtn, marginTop: 12 }} onClick={startNew}>
          <i className="ti ti-plus" style={{ fontSize: 16, marginRight: 6 }} aria-hidden="true" />
          Agregar producto
        </button>
      </section>

      {productos.length === 0 && (
        <section style={styles.emptyState}>
          <i className="ti ti-package" style={{ fontSize: 28, color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
          <p style={styles.mutedText}>
            {data.productos.length === 0 ? 'Todavía no hay productos. Agrega el primero.' : 'No se encontraron productos.'}
          </p>
        </section>
      )}

      {productos.map((p) => {
        const ganancia = (Number(p.precio) || 0) - (Number(p.costo) || 0);
        const margen = p.costo > 0 ? (ganancia / p.costo) * 100 : 0;
        const dias = p.ultimaVenta ? Math.floor((new Date() - new Date(p.ultimaVenta + 'T00:00:00')) / 86400000) : null;
        const bajaRotacion = dias !== null && dias > 30;
        const sinStock = (Number(p.cantidad) || 0) <= 0;

        return (
          <section key={p.id} style={{ ...styles.card, ...(bajaRotacion ? { borderColor: 'var(--color-border-warning)' } : {}) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardTitle}>{p.nombre}</p>
                <p style={styles.mutedText}>{p.categoria}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={styles.iconBtn} onClick={() => startEdit(p)} aria-label={`Editar ${p.nombre}`}>
                  <i className="ti ti-edit" style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
                <button style={styles.iconBtn} onClick={() => eliminar(p.id)} aria-label={`Eliminar ${p.nombre}`}>
                  <i className="ti ti-trash" style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.miniStat}>
                <p style={styles.statLabel}>Precio venta</p>
                <p style={styles.statValueSm}>{fmtMoney(p.precio)}</p>
              </div>
              <div style={styles.miniStat}>
                <p style={styles.statLabel}>Ganancia c/u</p>
                <p style={styles.statValueSm}>{fmtMoney(ganancia)} ({margen.toFixed(0)}%)</p>
              </div>
              <div style={styles.miniStat}>
                <p style={styles.statLabel}>Cantidad</p>
                <p style={{ ...styles.statValueSm, color: sinStock ? 'var(--color-text-danger)' : 'var(--color-text-primary)' }}>
                  {p.cantidad}
                </p>
              </div>
              <div style={styles.miniStat}>
                <p style={styles.statLabel}>Última venta</p>
                <p style={{ ...styles.statValueSm, color: bajaRotacion ? 'var(--color-text-warning)' : 'var(--color-text-primary)' }}>
                  {p.ultimaVenta ? fmtDate(p.ultimaVenta) : 'Sin dato'}
                </p>
              </div>
            </div>

            {bajaRotacion && (
              <p style={{ ...styles.mutedText, color: 'var(--color-text-warning)' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginRight: 4, verticalAlign: '-2px' }} aria-hidden="true" />
                Sin venderse hace {dias} días
              </p>
            )}

            <button style={styles.secondaryBtn} onClick={() => venderUno(p)} disabled={sinStock}>
              <i className="ti ti-minus" style={{ fontSize: 14, marginRight: 6 }} aria-hidden="true" />
              Registrar 1 vendido
            </button>
          </section>
        );
      })}

      {showForm && editing && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <p style={styles.cardTitle}>{data.productos.find((p) => p.id === editing.id) ? 'Editar producto' : 'Nuevo producto'}</p>

            <Field label="Nombre">
              <input type="text" value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} placeholder="Ej: Agua 600ml" />
            </Field>

            <Field label="Categoría">
              <select value={editing.categoria} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Costo de compra (por unidad)">
              <MoneyInput value={editing.costo} onChange={(v) => setEditing({ ...editing, costo: v })} />
            </Field>

            <Field label="Precio de venta (por unidad)">
              <MoneyInput value={editing.precio} onChange={(v) => setEditing({ ...editing, precio: v })} />
            </Field>

            <Field label="Cantidad actual en stock">
              <input type="number" inputMode="numeric" min="0" value={editing.cantidad} onChange={(e) => setEditing({ ...editing, cantidad: e.target.value })} />
            </Field>

            <Field label="Última vez que se vendió">
              <input type="date" value={editing.ultimaVenta} max={todayStr()} onChange={(e) => setEditing({ ...editing, ultimaVenta: e.target.value })} />
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => { setShowForm(false); setEditing(null); }}>
                Cancelar
              </button>
              <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={guardarProducto}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FIADOS
// ============================================================
function Fiados({ data, setData, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  const porCliente = useMemo(() => {
    const map = new Map();
    data.fiados.forEach((f) => {
      if (!map.has(f.cliente)) map.set(f.cliente, []);
      map.get(f.cliente).push(f);
    });
    const result = [];
    map.forEach((items, cliente) => {
      const saldo = items.reduce((acc, i) => acc + (Number(i.monto) || 0) - (Number(i.pagado) || 0), 0);
      const limite = Number(items[0].limite) || 0;
      items.sort((a, b) => b.fecha.localeCompare(a.fecha));
      result.push({ cliente, items, saldo, limite });
    });
    result.sort((a, b) => b.saldo - a.saldo);
    return result;
  }, [data.fiados]);

  const totalPendiente = porCliente.reduce((acc, c) => acc + c.saldo, 0);

  const startNew = () => {
    setForm({ id: uid(), cliente: '', fecha: todayStr(), detalle: '', monto: '', limite: '' });
    setShowForm(true);
  };

  const guardar = () => {
    if (!form.cliente.trim() || !form.monto) {
      showToast('Falta cliente o monto');
      return;
    }
    const existing = data.fiados.find((f) => f.cliente === form.cliente);
    const nuevo = {
      id: form.id,
      cliente: form.cliente.trim(),
      fecha: form.fecha,
      detalle: form.detalle,
      monto: Number(form.monto) || 0,
      pagado: 0,
      limite: form.limite ? Number(form.limite) : (existing ? existing.limite : 0),
    };
    setData({ ...data, fiados: [...data.fiados, nuevo] });
    setShowForm(false);
    setForm(null);
    showToast('Fiado registrado');
  };

  const registrarPago = (cliente, monto) => {
    let restante = monto;
    const fiados = data.fiados.map((f) => ({ ...f }));
    const deCliente = fiados.filter((f) => f.cliente === cliente).sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const f of deCliente) {
      const saldo = (Number(f.monto) || 0) - (Number(f.pagado) || 0);
      if (saldo <= 0 || restante <= 0) continue;
      const aplicar = Math.min(saldo, restante);
      f.pagado = (Number(f.pagado) || 0) + aplicar;
      restante -= aplicar;
    }
    setData({ ...data, fiados });
    showToast('Pago registrado');
  };

  return (
    <div style={styles.screen}>
      <section style={styles.heroCard}>
        <p style={styles.heroLabel}>Total pendiente de cobrar</p>
        <p style={styles.heroValue}>{fmtMoney(totalPendiente)}</p>
        <button style={styles.heroBtn} onClick={startNew}>
          <i className="ti ti-plus" style={{ fontSize: 16, marginRight: 6 }} aria-hidden="true" />
          Nuevo fiado
        </button>
      </section>

      {porCliente.length === 0 && (
        <section style={styles.emptyState}>
          <i className="ti ti-notebook" style={{ fontSize: 28, color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
          <p style={styles.mutedText}>Sin fiados registrados todavía.</p>
        </section>
      )}

      {porCliente.map(({ cliente, items, saldo, limite }) => {
        const pasaLimite = limite > 0 && saldo > limite;
        const isOpen = expandedClient === cliente;
        return (
          <section key={cliente} style={{ ...styles.card, ...(pasaLimite ? { borderColor: 'var(--color-border-danger)' } : {}) }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedClient(isOpen ? null : cliente)}
            >
              <div>
                <p style={styles.cardTitle}>{cliente}</p>
                {limite > 0 && <p style={styles.mutedText}>Límite: {fmtMoney(limite)}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ ...styles.statValueSm, color: saldo === 0 ? 'var(--color-text-success)' : pasaLimite ? 'var(--color-text-danger)' : 'var(--color-text-warning)' }}>
                  {fmtMoney(saldo)}
                </p>
                <p style={styles.mutedText}>{saldo === 0 ? 'Al día' : pasaLimite ? 'Pasó el límite' : 'Debe'}</p>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                {items.map((f) => (
                  <div key={f.id} style={styles.listRow}>
                    <div>
                      <p style={styles.listTitle}>{f.detalle || 'Fiado'}</p>
                      <p style={styles.listSub}>{fmtDate(f.fecha)}</p>
                    </div>
                    <p style={styles.listAmount}>{fmtMoney(f.monto)}</p>
                  </div>
                ))}
                {saldo > 0 && (
                  <PagoForm onSubmit={(m) => registrarPago(cliente, m)} max={saldo} />
                )}
              </div>
            )}
          </section>
        );
      })}

      {showForm && form && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <p style={styles.cardTitle}>Nuevo fiado</p>

            <Field label="Cliente">
              <input type="text" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre" />
            </Field>

            <Field label="Fecha">
              <input type="date" value={form.fecha} max={todayStr()} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </Field>

            <Field label="Detalle (opcional)">
              <input type="text" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="Ej: refrescos y galletas" />
            </Field>

            <Field label="Monto">
              <MoneyInput value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} />
            </Field>

            <Field label="Límite de fiado para este cliente (opcional)">
              <MoneyInput value={form.limite} onChange={(v) => setForm({ ...form, limite: v })} />
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => { setShowForm(false); setForm(null); }}>
                Cancelar
              </button>
              <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={guardar}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PagoForm({ onSubmit, max }) {
  const [monto, setMonto] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <MoneyInput value={monto} onChange={setMonto} placeholder="Monto pagado" />
      <button
        style={{ ...styles.secondaryBtn, flexShrink: 0 }}
        onClick={() => {
          const m = Number(monto);
          if (m > 0) {
            onSubmit(Math.min(m, max));
            setMonto('');
          }
        }}
      >
        Registrar pago
      </button>
    </div>
  );
}

// ============================================================
// HELPERS / UI PRIMITIVES
// ============================================================
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
      {hint && <p style={styles.fieldHint}>{hint}</p>}
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={styles.moneyPrefix}>L</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '0.00'}
        style={{ paddingLeft: 28 }}
      />
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'relative',
    background: 'var(--color-background-tertiary)',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '3rem 1rem',
  },
  ball: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--color-background-success)',
    animation: 'pulse 1s ease-in-out infinite',
  },
  header: {
    background: 'var(--color-background-success)',
    padding: '1.5rem 1rem 1.25rem',
  },
  headerInner: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 38, height: 38, borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--color-text-success)', flexShrink: 0,
  },
  title: { fontSize: 17, fontWeight: 500, margin: 0, color: 'var(--color-text-success)' },
  subtitle: { fontSize: 13, margin: '2px 0 0', color: 'var(--color-text-success)', opacity: 0.8, textTransform: 'capitalize' },
  errorBanner: {
    background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
    fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center',
  },
  main: { flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: '5rem' },
  screen: { display: 'flex', flexDirection: 'column', gap: 12 },
  nav: {
    position: 'sticky', bottom: 0,
    display: 'flex', justifyContent: 'space-around',
    background: 'var(--color-background-primary)',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    padding: '8px 4px',
  },
  navBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', padding: '6px 10px',
    color: 'var(--color-text-tertiary)', borderRadius: 'var(--border-radius-md)',
    transition: 'color 150ms ease',
  },
  navBtnActive: { color: 'var(--color-text-success)' },
  navLabel: { fontSize: 11 },
  heroCard: {
    background: 'var(--color-background-success)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  heroLabel: { fontSize: 13, color: 'var(--color-text-success)', opacity: 0.85, margin: 0 },
  heroValue: { fontSize: 30, fontWeight: 500, color: 'var(--color-text-success)', margin: '2px 0 8px' },
  heroHint: { fontSize: 13, color: 'var(--color-text-success)', opacity: 0.75, margin: '0 0 8px' },
  heroBtn: {
    background: 'var(--color-background-primary)', color: 'var(--color-text-success)',
    border: 'none', borderRadius: 'var(--border-radius-md)',
    padding: '10px 16px', fontSize: 14, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', transition: 'transform 150ms ease',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 },
  statCard: { background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '0.85rem 1rem' },
  miniStat: { background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '0.6rem 0.75rem' },
  statLabel: { fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' },
  statValue: { fontSize: 22, fontWeight: 500, margin: 0 },
  statValueSm: { fontSize: 15, fontWeight: 500, margin: 0 },
  card: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '1rem 1.1rem',
  },
  cardTitle: { fontSize: 16, fontWeight: 500, margin: '0 0 6px' },
  mutedText: { fontSize: 13, color: 'var(--color-text-secondary)', margin: '0' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '2rem 1rem', textAlign: 'center',
  },
  fieldLabel: { display: 'block', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 },
  fieldHint: { fontSize: 12, color: 'var(--color-text-tertiary)', margin: '4px 0 0' },
  moneyPrefix: {
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 14, color: 'var(--color-text-secondary)', pointerEvents: 'none',
  },
  resultBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)',
    padding: '0.85rem 1rem', margin: '4px 0 12px',
  },
  resultLabel: { fontSize: 14, color: 'var(--color-text-secondary)' },
  resultValue: { fontSize: 20, fontWeight: 500 },
  primaryBtn: {
    width: '100%', height: 44, border: 'none', borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-success)', color: 'var(--color-text-success)',
    fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 120ms ease',
  },
  secondaryBtn: {
    width: '100%', height: 40, border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
    fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, transition: 'transform 120ms ease, background 120ms ease',
  },
  iconBtn: {
    width: 32, height: 32, border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  linkBtn: {
    background: 'transparent', border: 'none', color: 'var(--color-text-info)',
    fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 0', marginTop: 4,
  },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  chip: {
    border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)',
    padding: '5px 12px', fontSize: 13, background: 'var(--color-background-primary)',
    color: 'var(--color-text-secondary)',
  },
  chipActive: {
    background: 'var(--color-background-success)', color: 'var(--color-text-success)',
    borderColor: 'var(--color-border-success)',
  },
  chartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, gap: 6, marginTop: 8 },
  chartCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 },
  chartBarWrap: { display: 'flex', alignItems: 'flex-end', height: 80, width: '100%', justifyContent: 'center' },
  chartBar: { width: '60%', borderRadius: '3px 3px 0 0', border: '0.5px solid', transition: 'height 200ms ease-out' },
  chartLabel: { fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'capitalize' },
  listRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  listTitle: { fontSize: 14, margin: 0 },
  listSub: { fontSize: 12, color: 'var(--color-text-tertiary)', margin: '2px 0 0' },
  listAmount: { fontSize: 14, fontWeight: 500, margin: 0 },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', zIndex: 50,
  },
  modal: {
    background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)',
    padding: '1.25rem', width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto',
  },
  toast: {
    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
    padding: '8px 16px', borderRadius: 'var(--border-radius-md)',
    fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
    animation: 'fadeUp 200ms ease-out', zIndex: 60,
  },
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
