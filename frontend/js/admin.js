const BASE = window.location.origin;

// Escondo la página mientras verifico si el usuario está logueado
document.body.style.visibility = 'hidden';

const usuarioGuardado = localStorage.getItem('nombreUsuario');
if (!usuarioGuardado) {
    // Si no hay sesión lo mando al inicio
    window.location.replace('/');
} else {
    document.body.style.visibility = 'visible';
    const el = document.getElementById('nombreUsuario');
    if (el) el.textContent = usuarioGuardado;
}

// Limpio el localStorage y mando al usuario de vuelta al público
window.cerrarSesion = function () {
    localStorage.removeItem('logueado');
    localStorage.removeItem('nombreUsuario');
    localStorage.removeItem('rol');
    window.location.replace('/');
};


// Muestro una notificación flotante en la esquina con diferentes colores según el tipo
function toast(msg, tipo = 'naranja') {
    const c = {
        naranja: { bg:'#FFF0E6', border:'#ffb085', text:'#C4622A' },
        verde:   { bg:'#F0FAF0', border:'#7bc67e', text:'#2e7d32' },
        rojo:    { bg:'#FFF0F0', border:'#FF7F7F', text:'#b00000' },
    }[tipo] || { bg:'#FFF0E6', border:'#ffb085', text:'#C4622A' };

    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:40px;left:60%;transform:translateX(-50%);
        background:${c.bg};border:2px solid ${c.border};color:${c.text};
        border-radius:12px;padding:12px 24px;font-size:14px;font-weight:700;
        z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.10);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000); // desaparece a los 3 segundos
}


// Colores y textos del semáforo de salud de cada mascota
const SEMAFORO = {
    verde:    { color: '#4CAF50', label: 'Saludable',           textColor: '#2e7d32' },
    amarilla: { color: '#FFC107', label: 'Atención pendiente',  textColor: '#b7680b' },
    roja:     { color: '#E53935', label: 'Cuidado urgente',     textColor: '#b00000' },
    gris:     { color: '#9E9E9E', label: 'Sin seguimiento',     textColor: '#555'    },
};

// Cargo los números del panel de inicio: mascotas, solicitudes, urgentes, donaciones
async function cargarResumen() {
    try {
        const data  = await (await fetch(`${BASE}/resumen`)).json();
        const stats = document.querySelectorAll('.resumen-num');
        if (stats[0]) stats[0].textContent = data.mascotas    ?? 0;
        if (stats[1]) stats[1].textContent = data.solicitudes ?? 0;
        if (stats[2]) stats[2].textContent = data.urgentes    ?? 0;
        if (stats[3]) stats[3].textContent = data.donado      ?? 0;
    } catch { console.error('Error resumen'); }
}

/* ── ALERTAS ── */
// Cargo y muestro la lista de alertas activas del sistema
async function cargarAlertas() {
    const cont = document.getElementById('lista-alertas');
    if (!cont) return;
    try {
        const data = await (await fetch(`${BASE}/alertas`)).json();
        if (!data.length) { cont.innerHTML = '<p class="cargando">No hay alertas.</p>'; return; }
        cont.innerHTML = data.map(a => `
            <div class="alerta-item ${a.tipo}">
                <div class="alerta-dot ${a.tipo}"></div>
                <div class="alerta-texto"><strong>${a.nombre}</strong> — ${a.texto}</div>
            </div>`).join('');
    } catch { cont.innerHTML = '<p class="cargando">Error.</p>'; }
}

/* ── SOLICITUDES DE ACCESO ── */
// Traigo los usuarios pendientes de aprobación y los muestro con botones de aprobar/rechazar
async function cargarSolicitudes() {
    const lista = document.getElementById('lista-solicitudes');
    if (!lista) return;
    lista.innerHTML = '<p class="cargando">Cargando...</p>';
    try {
        const datos = await (await fetch(`${BASE}/solicitudes`)).json();
        if (!datos.length) { lista.innerHTML = '<p class="cargando">No hay solicitudes pendientes.</p>'; return; }
        lista.innerHTML = datos.map(u => `
            <div class="solicitud-card">
                <div>
                    <p><strong>${u.Nombre}</strong></p>
                    <p style="color:#aaa;font-size:11px;">Solicitud pendiente</p>
                </div>
                <div class="sol-btns">
                    <button class="btn-aprobar"  onclick="responderSolicitud(${u.Id_usuario},'aprobado')">✓</button>
                    <button class="btn-rechazar" onclick="responderSolicitud(${u.Id_usuario},'rechazado')">✗</button>
                </div>
            </div>`).join('');
    } catch { lista.innerHTML = '<p class="cargando">Error al cargar.</p>'; }
}

// Envío la acción (aprobar o rechazar) al servidor y recargo la lista
window.responderSolicitud = async function (id, accion) {
    try {
        await fetch(`${BASE}/solicitud/${id}`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accion})
        });
        cargarSolicitudes(); cargarResumen();
        toast(`Usuario ${accion}`, accion === 'aprobado' ? 'verde' : 'rojo');
    } catch { toast('Error al procesar','rojo'); }
};

let sexoActual = 'hembra';

/* ── MASCOTAS ── */
// Cargo y pinto la lista de mascotas filtrando por sexo
async function cargarMascotas(sexo) {
    sexoActual = sexo;
    const tabId = sexo === 'hembra' ? 'hembras' : 'machos';
    const grid  = document.getElementById(tabId);
    if (!grid) return;

    grid.innerHTML = '<p class="cargando">Cargando mascotas...</p>';
    try {
        const data = await (await fetch(`${BASE}/mascotas?sexo=${sexo}`)).json();
        if (!data.length) {
            grid.innerHTML = `<p class="cargando">No hay ${sexo === 'hembra' ? 'hembras' : 'machos'} en el sistema.</p>`;
            return;
        }
        grid.innerHTML = `<div class="mas-lista">${data.map(m => tarjetaMascota(m)).join('')}</div>`;
    } catch { grid.innerHTML = '<p class="cargando">Error al cargar mascotas.</p>'; }
}

// Genero el HTML de una tarjeta de mascota con su foto, datos y botones de acción
function tarjetaMascota(m) {
    const s = SEMAFORO[m.semaforo] || SEMAFORO.gris;

    const foto = m.fotografia || m.Fotografia || '';
    const fotoSrc = foto ? (foto.startsWith('http') ? foto : `${BASE}/${foto}`) : '';
    const fotoEl = fotoSrc
        ? `<img src="${fotoSrc}" alt="${m.Nombre}" class="mas-row-foto"
            onerror="this.outerHTML='<div class=\\'mas-row-foto mas-row-foto-vacia\\'></div>'">`
        : `<div class="mas-row-foto mas-row-foto-vacia"></div>`;

    // Solo muestro la fecha del próximo cuidado si existe
    const proxInfo = m.prox_cuidado_tipo && m.prox_cuidado_fecha
        ? `<span class="mas-row-prox">📅 ${m.prox_cuidado_tipo}: ${String(m.prox_cuidado_fecha).substring(0,10)}</span>`
        : '';
    return `
    <div class="mas-row" data-id="${m.Id_mascota}">
        ${fotoEl}
        <div class="mas-row-info">
            <p class="mas-row-nombre">${m.Nombre}</p>
            <p class="mas-row-detalle">
                ${m.Edad != null ? `${m.Edad} año(s)` : '—'} &nbsp;·&nbsp;
                ${m.Peso != null ? `${m.Peso} kg` : '—'}
            </p>
            <div class="mas-row-estado" style="color:${s.textColor};background:${s.color}18;">
                <span class="mas-row-dot" style="background:${s.color};"></span>
                ${s.label}
                ${proxInfo}
            </div>
        </div>
        <div class="mas-row-acciones">
            <button class="btn-mas-ver"      onclick="abrirDetallesMascota(${m.Id_mascota})">Ver</button>
            <button class="btn-mas-editar"   onclick="abrirModalMascota(${m.Id_mascota})">Editar</button>
            <button class="btn-mas-eliminar" onclick="confirmarEliminar(${m.Id_mascota},'${m.Nombre.replace(/'/g,"\\'")}')">Eliminar</button>
        </div>
    </div>`;
}

/* ── MODAL DETALLES DE MASCOTA ── */
// Abro el panel de detalle de una mascota con sus cuidados, seguimientos e info
window.abrirDetallesMascota = async function (id) {
    let m;
    try { m = await (await fetch(`${BASE}/mascota/${id}`)).json(); }
    catch { toast('Error al cargar datos','rojo'); return; }

    const s = SEMAFORO[m.semaforo] || SEMAFORO.gris;

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;`;

    const hoyStr      = new Date().toISOString().split('T')[0];
    const mananaStr   = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();
    const sieteDiasStr = (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; })();

    // Genero HTML de cada cuidado con su badge de estado (vencido/próximo/ok)
    const cuidadosHTML = (m.cuidados && m.cuidados.length)
        ? m.cuidados.map(c => {
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const fp  = c.fecha_proxima ? new Date(c.fecha_proxima) : null;
            let badge = '';
            if (fp) {
                const diff = (fp - hoy) / 86400000;
                if (diff <= 0)      badge = `<span class="det-badge det-badge-rojo">Vencido</span>`;
                else if (diff <= 7) badge = `<span class="det-badge det-badge-amarillo">Próximo</span>`;
                else                badge = `<span class="det-badge det-badge-verde">OK</span>`;
            }
            return `<div class="det-row">
                <div style="flex:1;">
                    <span class="det-tipo">${c.tipo}</span>
                    ${badge}
                    <span class="det-fecha">Realizado: ${c.fecha ? c.fecha.substring(0,10):'—'}</span>
                    ${fp ? `<span class="det-fecha">Próximo: ${fp.toISOString().substring(0,10)}</span>` : ''}
                    ${c.descripcion ? `<p class="det-desc">${c.descripcion}</p>` : ''}
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="det-btn-edit" data-tipo="cuidado" data-cuidado-id="${c.id_cuidado}"
                        data-cuidado-tipo="${c.tipo}"
                        data-cuidado-fecha="${c.fecha ? c.fecha.substring(0,10) : ''}"
                        data-cuidado-fprox="${c.fecha_proxima ? new Date(c.fecha_proxima).toISOString().substring(0,10) : ''}"
                        data-cuidado-desc="${c.descripcion || ''}">Editar</button>
                    <button class="det-btn-del" data-tipo="cuidado" data-cuidado-id="${c.id_cuidado}">Eliminar</button>
                </div>
            </div>`;
        }).join('')
        : '<p class="cargando" style="margin:8px 0;">Sin cuidados registrados.</p>';

    // Muestro los últimos 5 seguimientos con colores según nivel de energía
    const segHTML = (m.seguimientos && m.seguimientos.length)
        ? m.seguimientos.slice(0,5).map(sg => {
            const energ = sg.energia != null
                ? `<span class="det-energ" style="background:${sg.energia>=7?'#e8f5e9':sg.energia>=4?'#fff8e1':'#feecec'};
                    color:${sg.energia>=7?'#2e7d32':sg.energia>=4?'#b7680b':'#b00000'};">
                    Energía ${sg.energia}/10</span>`
                : '';
            return `<div class="det-row">
                <div style="flex:1;">
                    <span class="det-fecha">${sg.fecha ? sg.fecha.substring(0,10):'—'}</span>
                    ${sg.comportamiento ? `<span class="det-tipo">${sg.comportamiento}</span>` : ''}
                    ${energ}
                    ${sg.notas ? `<p class="det-desc">${sg.notas}</p>` : ''}
                </div>
                <button class="det-btn-del" data-tipo="seguimiento" data-seg-id="${sg.id_seguimiento}">Eliminar</button>
            </div>`;
        }).join('')
        : '<p class="cargando" style="margin:8px 0;">Sin seguimientos registrados.</p>';

    const fotoRaw = m.fotografia || m.Fotografia || '';
    const fotoHeader = fotoRaw
        ? `<img src="${fotoRaw.startsWith('http') ? fotoRaw : `${BASE}/${fotoRaw}`}"
               style="width:48px;height:48px;border-radius:50%;object-fit:cover;
                      border:2.5px solid ${s.color};flex-shrink:0;"
               onerror="this.outerHTML='<div style=\\'width:48px;height:48px;border-radius:50%;background:${s.color}20;border:2.5px solid ${s.color};display:flex;align-items:center;justify-content:center;font-size:22px;\\'>🐾</div>'">`
        : `<div style="width:48px;height:48px;border-radius:50%;background:${s.color}20;
               border:2.5px solid ${s.color};display:flex;align-items:center;
               justify-content:center;font-size:22px;flex-shrink:0;"></div>`;

    overlay.innerHTML = `
    <div style="background:white;border-radius:18px;border:2.5px solid ${s.color};
                padding:0;width:min(420px,88vw);max-height:90vh;overflow:hidden;
                display:flex;flex-direction:column;
                box-shadow:0 8px 32px rgba(0,0,0,0.18);">

        <style>
            .det-tabs{display:flex;border-bottom:0.5px solid #eee;}
            .det-tab{flex:1;padding:12px 0;text-align:center;font-size:13px;font-weight:700;
                cursor:pointer;border:none;background:transparent;color:#aaa;transition:0.2s;}
            .det-tab.activo{color:${s.color};border-bottom:3px solid ${s.color};}
            .det-panel{display:none;padding:12px 16px;overflow-y:auto;max-height:calc(90vh - 150px);}
            .det-panel.activo{display:block;}
            .det-row{display:flex;align-items:flex-start;gap:8px;padding:8px 0;
                border-bottom:0.5px solid #f5f5f5;}
            .det-tipo{font-size:13px;font-weight:700;color:#555;margin-right:6px;}
            .det-fecha{font-size:11px;color:#aaa;margin-right:6px;}
            .det-desc{font-size:12px;color:#888;margin:4px 0 0;}
            .det-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-right:4px;}
            .det-badge-rojo{background:#feecec;color:#b00000;}
            .det-badge-amarillo{background:#fff8e1;color:#b7680b;}
            .det-badge-verde{background:#f1f8e9;color:#2e7d32;}
            .det-energ{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:4px;}
            .det-btn-del{background:#fff0f0;border:1.5px solid #e74c3c;border-radius:8px;color:#c0392b;
                font-size:12px;font-weight:700;padding:5px 12px;cursor:pointer;flex-shrink:0;
                align-self:center;}
            .det-btn-del:hover{background:#ffd6d6;}
            .det-btn-edit{background:#f0f4ff;border:1.5px solid #3a7bd5;border-radius:8px;color:#3a7bd5;
                font-size:12px;font-weight:700;padding:5px 12px;cursor:pointer;flex-shrink:0;align-self:center;}
            .det-btn-edit:hover{background:#d0e4ff;}
            .det-form-row{display:flex;gap:8px;margin-bottom:8px;}
            .det-input{flex:1;padding:8px 10px;border:1.5px solid #eee;border-radius:8px;
                font-size:13px;outline:none;font-family:inherit;min-width:0;}
            .det-input:focus{border-color:${s.color};}
            .det-btn-add{width:100%;padding:10px 16px;background:${s.color};color:white;border:none;
                border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;}
            .det-section-title{font-size:13px;font-weight:700;color:#888;margin:10px 0 6px;
                text-transform:uppercase;letter-spacing:0.5px;}
        </style>

        <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:0.5px solid #eee;">
            ${fotoHeader}
            <div style="flex:1;min-width:0;">
                <p style="margin:0;font-size:17px;font-weight:700;color:#333;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.Nombre}</p>
                <p style="margin:0;font-size:12px;color:#aaa;">
                    ${m.Edad!=null?`${m.Edad} años`:'—'} · ${m.Peso!=null?`${m.Peso}kg`:'—'} · ${m.Sexo||'—'}
                </p>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                <div style="width:9px;height:9px;border-radius:50%;background:${s.color};"></div>
                <span style="font-size:12px;font-weight:700;color:${s.textColor||'#555'};">${s.label}</span>
            </div>
            <button id="det-btn-cerrar"
                style="background:none;border:none;font-size:20px;cursor:pointer;color:#aaa;
                       line-height:1;flex-shrink:0;margin-left:4px;">✕</button>
        </div>

        <div class="det-tabs">
            <button class="det-tab activo" onclick="cambiarDetTab(this,'det-cuidados')">Cuidados</button>
            <button class="det-tab"        onclick="cambiarDetTab(this,'det-seguimiento')">Seguimiento</button>
            <button class="det-tab"        onclick="cambiarDetTab(this,'det-info')">Info</button>
        </div>

        <!-- Panel cuidados con formulario para agregar uno nuevo -->
        <div class="det-panel activo" id="det-cuidados">
            <p class="det-section-title">Registrar cuidado</p>
            <div class="det-form-row">
                <input class="det-input" id="det-c-tipo" placeholder="Tipo (vacuna, baño…)">
            </div>
            <div class="det-form-row" style="flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#aaa;display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="chk-c-fecha" checked style="cursor:pointer;"> Fecha realizado
                </label>
                <input class="det-input" id="det-c-fecha" type="date" max="${hoyStr}" style="display:block;">
                <label style="font-size:11px;color:#aaa;display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:4px;">
                    <input type="checkbox" id="chk-c-fprox" style="cursor:pointer;"> Próxima fecha
                </label>
                <input class="det-input" id="det-c-fprox" type="date" min="${mananaStr}" style="display:none;">
            </div>
            <div class="det-form-row">
                <input class="det-input" id="det-c-desc" placeholder="Descripción (opcional)">
            </div>
            <button class="det-btn-add" id="det-add-cuidado-btn">+ Agregar cuidado</button>
            <p class="det-section-title" style="margin-top:14px;">Historial</p>
            <div id="det-cuidados-lista">${cuidadosHTML}</div>
        </div>

        <!-- Panel seguimientos con formulario para agregar uno nuevo -->
        <div class="det-panel" id="det-seguimiento">
            <p class="det-section-title">Registrar seguimiento</p>
            <div class="det-form-row">
                <input class="det-input" id="det-s-fecha" type="date" max="${hoyStr}" min="${sieteDiasStr}">
            </div>
            <div class="det-form-row">
                <input class="det-input" id="det-s-comp" placeholder="Comportamiento (opcional)">
            </div>
            <div class="det-form-row" style="align-items:center;gap:10px;">
                <label style="font-size:12px;color:#888;white-space:nowrap;">Energía (1-10)</label>
                <input class="det-input" id="det-s-energ" type="number" min="1" max="10" placeholder="—" style="max-width:80px;">
            </div>
            <div class="det-form-row">
                <textarea class="det-input" id="det-s-notas" placeholder="Notas (opcional)" rows="2" style="resize:none;"></textarea>
            </div>
            <button class="det-btn-add" id="det-add-seg-btn">+ Agregar seguimiento</button>
            <p class="det-section-title" style="margin-top:14px;">Historial</p>
            <div id="det-seg-lista">${segHTML}</div>
        </div>

        <!-- Panel info con características de la mascota -->
        <div class="det-panel" id="det-info">
            ${m.Caracteristicas
                ? `<p style="font-size:14px;color:#555;line-height:1.7;">${m.Caracteristicas}</p>`
                : '<p style="font-size:13px;color:#ccc;text-align:center;margin-top:20px;">Sin descripción.</p>'}
        </div>
    </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#det-btn-cerrar').onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    // Pongo la fecha de hoy por defecto en los campos de fecha
    const inpFecha  = overlay.querySelector('#det-c-fecha');
    const inpSFecha = overlay.querySelector('#det-s-fecha');
    if (inpFecha)  inpFecha.value  = hoyStr;
    if (inpSFecha) inpSFecha.value = hoyStr;

    // Muestro u oculto el campo de fecha según el checkbox
    overlay.querySelector('#chk-c-fecha')?.addEventListener('change', e => {
        const inp = overlay.querySelector('#det-c-fecha');
        inp.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) inp.value = hoyStr;
    });
    overlay.querySelector('#chk-c-fprox')?.addEventListener('change', e => {
        const inp = overlay.querySelector('#det-c-fprox');
        inp.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) inp.value = '';
    });

    overlay.querySelector('#det-add-cuidado-btn').onclick = () => agregarCuidado(m.Id_mascota);
    overlay.querySelector('#det-add-seg-btn').onclick     = () => agregarSeguimiento(m.Id_mascota);

    // Manejo clicks en los botones de eliminar y editar cuidados
    overlay.querySelector('#det-cuidados-lista').addEventListener('click', async e => {
        const btnDel = e.target.closest('.det-btn-del[data-tipo="cuidado"]');
        if (btnDel) {
            const idCuidado = btnDel.dataset.cuidadoId;
            btnDel.textContent = '…'; btnDel.disabled = true;
            try {
                await fetch(`${BASE}/cuidado/${idCuidado}`, { method:'DELETE' });
                toast('Cuidado eliminado', 'rojo');
                overlay.remove();
                await abrirDetallesMascota(m.Id_mascota);
                cargarMascotas(sexoActual);
            } catch { toast('Error al eliminar','rojo'); btnDel.textContent='✕'; btnDel.disabled=false; }
            return;
        }

        // Si le dan editar abro el mini modal de edición
        const btnEdit = e.target.closest('.det-btn-edit[data-tipo="cuidado"]');
        if (btnEdit) {
            const idCuidado = btnEdit.dataset.cuidadoId;
            abrirEditarCuidado(idCuidado, {
                tipo:  btnEdit.dataset.cuidadoTipo,
                fecha: btnEdit.dataset.cuidadoFecha,
                fprox: btnEdit.dataset.cuidadoFprox,
                desc:  btnEdit.dataset.cuidadoDesc,
            }, m.Id_mascota, overlay);
        }
    });

    // Manejo clicks en eliminar seguimientos
    overlay.querySelector('#det-seg-lista').addEventListener('click', async e => {
        const btn = e.target.closest('.det-btn-del[data-tipo="seguimiento"]');
        if (!btn) return;
        const idSeg = btn.dataset.segId;
        btn.textContent = '…'; btn.disabled = true;
        try {
            await fetch(`${BASE}/seguimiento/${idSeg}`, { method:'DELETE' });
            toast('Seguimiento eliminado', 'rojo');
            overlay.remove();
            await abrirDetallesMascota(m.Id_mascota);
            cargarMascotas(sexoActual);
        } catch { toast('Error al eliminar','rojo'); btn.textContent='✕'; btn.disabled=false; }
    });
};

// Cambio el tab activo dentro del modal de detalles
window.cambiarDetTab = function (btn, panelId) {
    btn.closest('.det-tabs').querySelectorAll('.det-tab').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    btn.closest('[style*=fixed]').querySelectorAll('.det-panel').forEach(p => p.classList.remove('activo'));
    document.getElementById(panelId)?.classList.add('activo');
};

/* ── EDITAR CUIDADO ── */
// Abro un mini modal encima del modal principal para editar un cuidado existente
function abrirEditarCuidado(idCuidado, datos, idMascota, overlayPrincipal) {
    const hoy     = new Date().toISOString().split('T')[0];
    const manana  = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();

    const mini = document.createElement('div');
    mini.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.5);z-index:10000;
        display:flex;align-items:center;justify-content:center;`;

    mini.innerHTML = `
    <div style="background:white;border-radius:16px;border:2px solid #DDA0DD;
                padding:16px 18px;width:min(340px,82vw);display:flex;flex-direction:column;gap:10px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#9b59b6;">Editar cuidado</p>

        <div>
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:3px;">Tipo *</label>
            <input id="ec-tipo" value="${datos.tipo || ''}"
                style="width:100%;padding:9px 10px;border:1.5px solid #DDA0DD;border-radius:8px;
                       font-size:13px;box-sizing:border-box;outline:none;">
        </div>

        <div>
            <label style="font-size:11px;color:#aaa;display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;">
                <input type="checkbox" id="ec-chk-fecha" ${datos.fecha ? 'checked' : ''} style="cursor:pointer;">
                Fecha realizado
            </label>
            <input id="ec-fecha" type="date" value="${datos.fecha || ''}" max="${hoy}"
                style="width:100%;padding:9px 10px;border:1.5px solid #DDA0DD;border-radius:8px;
                       font-size:13px;box-sizing:border-box;outline:none;
                       display:${datos.fecha ? 'block' : 'none'};">
        </div>

        <div>
            <label style="font-size:11px;color:#aaa;display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;">
                <input type="checkbox" id="ec-chk-fprox" ${datos.fprox ? 'checked' : ''} style="cursor:pointer;">
                Próxima fecha
            </label>
            <input id="ec-fprox" type="date" value="${datos.fprox || ''}" min="${manana}"
                style="width:100%;padding:9px 10px;border:1.5px solid #DDA0DD;border-radius:8px;
                       font-size:13px;box-sizing:border-box;outline:none;
                       display:${datos.fprox ? 'block' : 'none'};">
        </div>

        <div>
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:3px;">Descripción (opcional)</label>
            <input id="ec-desc" value="${datos.desc || ''}"
                style="width:100%;padding:9px 10px;border:1.5px solid #DDA0DD;border-radius:8px;
                       font-size:13px;box-sizing:border-box;outline:none;">
        </div>

        <p id="ec-error" style="color:#E05555;font-size:12px;min-height:14px;margin:0;"></p>

        <div style="display:flex;gap:8px;">
            <button id="ec-cancelar" style="flex:1;padding:9px;border:1.5px solid #ddd;border-radius:8px;
                background:#f9f9f9;color:#999;font-weight:700;cursor:pointer;font-size:13px;">Cancelar</button>
            <button id="ec-guardar" style="flex:2;padding:9px;border:none;border-radius:8px;
                background:#D8BFD8;color:white;font-weight:700;cursor:pointer;font-size:13px;">Guardar cambios</button>
        </div>
    </div>`;

    document.body.appendChild(mini);

    // Muestro u oculto los campos de fecha según los checkboxes
    mini.querySelector('#ec-chk-fecha').addEventListener('change', e => {
        const inp = mini.querySelector('#ec-fecha');
        inp.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) inp.value = hoy;
    });
    mini.querySelector('#ec-chk-fprox').addEventListener('change', e => {
        const inp = mini.querySelector('#ec-fprox');
        inp.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) inp.value = '';
    });

    mini.querySelector('#ec-cancelar').onclick = () => mini.remove();
    mini.onclick = e => { if (e.target === mini) mini.remove(); };

    // Guardo los cambios del cuidado y recargo la vista
    mini.querySelector('#ec-guardar').onclick = async () => {
        const tipo  = mini.querySelector('#ec-tipo').value.trim();
        const fecha = mini.querySelector('#ec-chk-fecha').checked ? mini.querySelector('#ec-fecha').value || null : null;
        const fprox = mini.querySelector('#ec-chk-fprox').checked ? mini.querySelector('#ec-fprox').value || null : null;
        const desc  = mini.querySelector('#ec-desc').value.trim();
        const err   = mini.querySelector('#ec-error');

        if (!tipo) { err.textContent = 'El tipo es obligatorio.'; return; }

        try {
            const res  = await fetch(`${BASE}/cuidado/${idCuidado}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, fecha, fecha_proxima: fprox, descripcion: desc || null })
            });
            const data = await res.json();
            if (!res.ok) { err.textContent = data.mensaje || 'Error al guardar.'; return; }
            toast('Cuidado actualizado', 'verde');
            mini.remove();
            overlayPrincipal.remove();
            await abrirDetallesMascota(idMascota);
            cargarMascotas(sexoActual);
        } catch { err.textContent = 'Error al conectar.'; }
    };
}

// Tomo los datos del formulario de cuidado y los envío al servidor
window.agregarCuidado = async function (idMascota) {
    const tipo  = document.getElementById('det-c-tipo')?.value.trim();
    const fecha = document.getElementById('chk-c-fecha')?.checked
        ? document.getElementById('det-c-fecha')?.value || null
        : null;
    const fprox = document.getElementById('chk-c-fprox')?.checked
        ? document.getElementById('det-c-fprox')?.value || null
        : null;
    const desc  = document.getElementById('det-c-desc')?.value.trim();

    if (!tipo) { toast('El tipo es obligatorio','rojo'); return; }

    try {
        const res  = await fetch(`${BASE}/cuidado`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id_mascota: idMascota, tipo, fecha, fecha_proxima: fprox||null, descripcion: desc||null })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.mensaje||'Error','rojo'); return; }
        toast(data.mensaje, 'verde');
        document.querySelector('[style*=fixed]')?.remove();
        await abrirDetallesMascota(idMascota);
        cargarMascotas(sexoActual);
    } catch { toast('Error al conectar','rojo'); }
};

// Elimino un cuidado y recargo la vista de la mascota
window.eliminarCuidado = async function (idCuidado, idMascota) {
    try {
        await fetch(`${BASE}/cuidado/${idCuidado}`, { method:'DELETE' });
        toast('Cuidado eliminado','rojo');
        document.querySelector('[style*=fixed]')?.remove();
        await abrirDetallesMascota(idMascota);
        cargarMascotas(sexoActual);
    } catch { toast('Error','rojo'); }
};

// Tomo los datos del formulario de seguimiento y los envío al servidor
window.agregarSeguimiento = async function (idMascota) {
    const fecha = document.getElementById('det-s-fecha')?.value;
    const comp  = document.getElementById('det-s-comp')?.value.trim();
    const energ = document.getElementById('det-s-energ')?.value;
    const notas = document.getElementById('det-s-notas')?.value.trim();

    if (!fecha) { toast('La fecha es obligatoria','rojo'); return; }

    try {
        const res  = await fetch(`${BASE}/seguimiento`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id_mascota: idMascota, fecha, comportamiento: comp||null, energia: energ||null, notas: notas||null })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.mensaje||'Error','rojo'); return; }
        toast(data.mensaje, 'verde');
        document.querySelector('[style*=fixed]')?.remove();
        await abrirDetallesMascota(idMascota);
        cargarMascotas(sexoActual);
    } catch { toast('Error al conectar','rojo'); }
};

// Elimino un seguimiento de la BD
window.eliminarSeguimiento = async function (idSeg, idMascota) {
    try {
        await fetch(`${BASE}/seguimiento/${idSeg}`, { method:'DELETE' });
        toast('Seguimiento eliminado','rojo');
        document.querySelector('[style*=fixed]')?.remove();
        await abrirDetallesMascota(idMascota);
    } catch { toast('Error','rojo'); }
};

/* ── MODAL AGREGAR / EDITAR MASCOTA ── */
// Si recibo id cargo los datos existentes, si no preparo un formulario vacío para nueva
window.abrirModalMascota = async function (id = null) {
    let mascota = { Nombre:'', Edad:'', Peso:'', Sexo:sexoActual, Caracteristicas:'', Fotografia:'' };

    if (id) {
        try { mascota = await (await fetch(`${BASE}/mascota/${id}`)).json();
            mascota.fotografia = mascota.fotografia || mascota.Fotografia || ''; }
        catch { toast('Error cargando datos','rojo'); return; }
    }

    const esNueva = !id;
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;`;

    overlay.innerHTML = `
    <div style="background:white;border-radius:18px;border:2.5px solid #DDA0DD;
                padding:18px 20px;width:min(370px,82vw);max-height:82vh;overflow-y:auto;
                box-shadow:0 8px 32px rgba(200,100,200,0.18);
                display:flex;flex-direction:column;gap:14px;">
        <style>
            .mas-m-label{font-size:12px;font-weight:700;color:#9b59b6;margin-bottom:3px;display:block;}
            .mas-m-input{width:100%;padding:10px 12px;border:2px solid #DDA0DD;border-radius:10px;
                font-size:14px;background:#fdf5ff;color:#555;box-sizing:border-box;outline:none;font-family:inherit;}
            .mas-m-input:focus{border-color:#b57bee;background:white;}
            .mas-m-row{display:flex;gap:10px;}
            .mas-m-row>div{flex:1;display:flex;flex-direction:column;}
            .mas-btn-g{background:#D8BFD8;color:white;border:none;border-radius:10px;
                padding:12px;font-size:15px;font-weight:700;cursor:pointer;}
            .mas-btn-g:hover{background:#c09bc0;}
            .mas-btn-c{background:#f5f5f5;color:#999;border:2px solid #ddd;border-radius:10px;
                padding:12px;font-size:14px;font-weight:700;cursor:pointer;}
        </style>
        <p style="margin:0;font-size:18px;font-weight:800;color:#9b59b6;text-align:center;">
            ${esNueva ? '+ Nueva mascota' : 'Editar mascota'}
        </p>
        <div>
            <label class="mas-m-label">Nombre *</label>
            <input id="mas-nombre" class="mas-m-input" placeholder="Nombre de la mascota" value="${mascota.Nombre||''}">
        </div>
        <div class="mas-m-row">
            <div>
                <label class="mas-m-label">Edad (años)</label>
                <input id="mas-edad" class="mas-m-input" type="number" min="0" placeholder="Edad" value="${mascota.Edad??''}">
            </div>
            <div>
                <label class="mas-m-label">Peso (kg)</label>
                <input id="mas-peso" class="mas-m-input" type="number" min="0" step="0.1" placeholder="Peso" value="${mascota.Peso??''}">
            </div>
        </div>
        <div>
            <label class="mas-m-label">Sexo *</label>
            <select id="mas-sexo" class="mas-m-input">
                <option value="hembra" ${(mascota.Sexo||'').toLowerCase()==='hembra'?'selected':''}>Hembra</option>
                <option value="macho"  ${(mascota.Sexo||'').toLowerCase()==='macho' ?'selected':''}>Macho</option>
            </select>
        </div>
        <div>
            <label class="mas-m-label">Características</label>
            <textarea id="mas-caract" class="mas-m-input" rows="3" style="resize:none;"
                placeholder="Descripción, raza, notas…">${mascota.Caracteristicas||''}</textarea>
        </div>
        <div>
            <label class="mas-m-label">Fotografía</label>
            <div style="display:flex;align-items:center;gap:10px;">
                <div id="mas-foto-thumb" style="width:52px;height:52px;border-radius:10px;
                    border:2px solid #DDA0DD;overflow:hidden;background:#fdf5ff;
                    display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                    ${mascota.fotografia
                        ? `<img src="${mascota.fotografia.startsWith('http') ? mascota.fotografia : `${BASE}/${mascota.fotografia}`}" style="width:100%;height:100%;object-fit:cover;">`
                        : '🐾'}
                </div>
                <div style="flex:1;min-width:0;">
                    <label style="display:inline-block;padding:7px 14px;background:#f0e6ff;
                        border:1.5px solid #DDA0DD;border-radius:8px;cursor:pointer;
                        font-size:12px;font-weight:700;color:#9b59b6;">
                        Seleccionar foto
                        <input type="file" id="mas-foto-file" accept="image/*" style="display:none;">
                    </label>
                    <p id="mas-foto-nombre" style="font-size:11px;color:#bbb;margin:4px 0 0;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${mascota.fotografia ? mascota.fotografia.split('/').pop() : 'Sin foto'}
                    </p>
                </div>
            </div>
        </div>
        <p id="mas-modal-error" style="color:#E05555;font-size:12px;text-align:center;min-height:16px;margin:0;"></p>
        <div style="display:flex;gap:10px;">
            <button class="mas-btn-c" id="mas-btn-cancelar" style="flex:1;">Cancelar</button>
            <button class="mas-btn-g" id="mas-btn-guardar"  style="flex:2;">
                ${esNueva ? 'Guardar mascota' : 'Guardar cambios'}
            </button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#mas-btn-cancelar').onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    // Muestro preview de la foto cuando el usuario selecciona un archivo
    const fileInput = overlay.querySelector('#mas-foto-file');
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        overlay.querySelector('#mas-foto-nombre').textContent = file.name;
        const thumb = overlay.querySelector('#mas-foto-thumb');
        thumb.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover;">`;
    });

    // Envío el formulario como FormData porque puede incluir una imagen
    overlay.querySelector('#mas-btn-guardar').onclick = async () => {
        const nombre          = overlay.querySelector('#mas-nombre').value.trim();
        const edad            = overlay.querySelector('#mas-edad').value;
        const peso            = overlay.querySelector('#mas-peso').value;
        const sexo            = overlay.querySelector('#mas-sexo').value;
        const caracteristicas = overlay.querySelector('#mas-caract').value.trim();
        const errorEl         = overlay.querySelector('#mas-modal-error');

        if (!nombre) { errorEl.textContent = 'El nombre es obligatorio.'; return; }

        const formData = new FormData();
        formData.append('nombre',          nombre);
        formData.append('edad',            edad || '');
        formData.append('peso',            peso || '');
        formData.append('sexo',            sexo);
        formData.append('caracteristicas', caracteristicas);
        formData.append('fotoActual',      mascota.fotografia || '');

        if (fileInput.files[0]) {
            formData.append('fotografia', fileInput.files[0]);
        }

        const url    = esNueva ? `${BASE}/mascota` : `${BASE}/mascota/${id}`;
        const method = esNueva ? 'POST' : 'PUT';

        try {
            const res  = await fetch(url, { method, body: formData });
            const data = await res.json();
            if (!res.ok) { errorEl.textContent = data.mensaje || 'Error al guardar.'; return; }
            overlay.remove();
            toast(data.mensaje, 'verde');
            cargarMascotas(sexo);
            cargarResumen();
        } catch { errorEl.textContent = 'Error al conectar con el servidor.'; }
    };
};

/* ── CONFIRMACIÓN ELIMINAR MASCOTA ── */
// Muestro un diálogo de confirmación antes de borrar definitivamente
window.confirmarEliminar = function (id, nombre) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;`;

    overlay.innerHTML = `
    <div style="background:white;border-radius:16px;border:2.5px solid #FF7F7F;
                padding:28px 32px;width:340px;text-align:center;
                display:flex;flex-direction:column;gap:16px;
                box-shadow:0 6px 24px rgba(255,0,0,0.12);">
        <p style="font-size:38px;margin:0;"></p>
        <p style="font-size:15px;font-weight:700;color:#C0392B;margin:0;">¿Eliminar a <strong>${nombre}</strong>?</p>
        <p style="font-size:13px;color:#aaa;margin:0;">Esta acción no se puede deshacer.</p>
        <div style="display:flex;gap:10px;">
            <button id="btn-cancel-del" style="flex:1;padding:10px;border:2px solid #ddd;border-radius:10px;
                background:#f9f9f9;color:#999;font-weight:700;cursor:pointer;font-size:14px;">Cancelar</button>
            <button id="btn-confirm-del" style="flex:1;padding:10px;border:none;border-radius:10px;
                background:#FF7F7F;color:white;font-weight:700;cursor:pointer;font-size:14px;">Sí, eliminar</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-cancel-del').onclick  = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('#btn-confirm-del').onclick = async () => {
        try {
            const res  = await fetch(`${BASE}/mascota/${id}`, { method:'DELETE' });
            const data = await res.json();
            overlay.remove();
            toast(data.mensaje,'rojo');
            cargarMascotas(sexoActual);
            cargarResumen();
        } catch { toast('Error al eliminar','rojo'); overlay.remove(); }
    };
};

/* ── SOLICITUDES DE DONACIÓN ── */
// Cargo las donaciones pendientes de aprobación del lado público
async function cargarDonaciones() {
    const cont = document.getElementById('lista-donaciones');
    if (!cont) return;
    cont.innerHTML = '<p class="cargando">Cargando...</p>';
    try {
        const data = await (await fetch(`${BASE}/donaciones`)).json();
        if (!data.length) { cont.innerHTML = '<p class="cargando">No hay solicitudes de donación.</p>'; return; }
        cont.innerHTML = data.map(d => `
            <div class="solicitud-card">
                <div>
                    <p><strong>${d.Nombre || 'Sin nombre'}</strong> — ${d.Descripcion}</p>
                    <p style="color:#aaa;font-size:11px;">
                        ${d.Cantidad} ${d.unidad || ''} | ${d.Fecha ? d.Fecha.substring(0,10) : 'Sin fecha'}
                    </p>
                </div>
                <div class="sol-btns">
                    <button class="btn-aprobar"  onclick="responderDonacion(${d.Id_donacion},'aprobado')">✓</button>
                    <button class="btn-rechazar" onclick="responderDonacion(${d.Id_donacion},'rechazado')">✗</button>
                </div>
            </div>`).join('');
    } catch { cont.innerHTML = '<p class="cargando">Error al cargar.</p>'; }
}

// Apruebo o rechazo una donación y si se aprueba se suma al inventario automáticamente
window.responderDonacion = async function (id, accion) {
    try {
        await fetch(`${BASE}/donacion/${id}`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accion})
        });
        cargarDonaciones(); cargarInventarioAdmin(); cargarResumen();
        toast(`Donación ${accion}`, accion === 'aprobado' ? 'verde' : 'rojo');
    } catch { toast('Error al procesar','rojo'); }
};

/* ── INVENTARIO ADMIN ── */
// Cargo la lista de artículos del inventario con su cantidad actual
async function cargarInventarioAdmin() {
    const cont = document.getElementById('inventario-admin-lista');
    if (!cont) return;
    cont.innerHTML = '<p class="cargando">Cargando inventario...</p>';
    try {
        const data = await (await fetch(`${BASE}/inventario`)).json();
        if (!data.length) { cont.innerHTML = '<p class="cargando">No hay artículos en el inventario.</p>'; return; }
        cont.innerHTML = data.map(i => `
            <div class="inv-admin-card" data-inv-id="${i.Id_inventario}" data-inv-tipo="${i.Tipo}">
                <div class="inv-admin-info">
                    <p class="inv-admin-tipo">${i.Tipo}</p>
                    <p class="inv-admin-cantidad">Cantidad: <strong>${i.Cantidad} ${i.Unidad||''}</strong></p>
                    <p class="inv-admin-fecha">Fecha: ${i.Fecha?i.Fecha.substring(0,10):'—'}</p>
                </div>
                <button class="btn-descontar" onclick="descontarInventario(${i.Id_inventario},${i.Cantidad})">Editar</button>
            </div>`).join('');
    } catch { cont.innerHTML = '<p class="cargando">Error al cargar.</p>'; }
}

/* ── MODAL EDITAR INVENTARIO ── */
// Abro un modal con tabs para descontar o agregar cantidad a un artículo del inventario
function abrirModalInventario(id, tipo, disponible) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.35);z-index:9999;
        display:flex;align-items:center;justify-content:center;`;

    overlay.innerHTML = `
    <div style="background:white;border-radius:18px;border:2.5px solid #FBCBA8;
                padding:28px 32px;width:340px;display:flex;flex-direction:column;gap:14px;
                box-shadow:0 8px 32px rgba(255,176,133,0.18);">
        <style>
            .inv-tab-btn{flex:1;padding:9px 0;border:2px solid #FBCBA8;border-radius:8px;
                font-size:13px;font-weight:700;cursor:pointer;background:white;color:#D0784A;}
            .inv-tab-btn.activo{background:#ffb085;color:white;border-color:#ffb085;}
            .inv-m-input{width:100%;padding:10px 14px;border:2px solid #FBCBA8;border-radius:10px;
                font-size:15px;background:#FFF6F0;color:#C4622A;box-sizing:border-box;outline:none;
                text-align:center;font-weight:700;}
            .inv-m-input:focus{border-color:#ffb085;background:white;}
            .inv-btn-ok{width:100%;padding:11px;border:none;border-radius:10px;
                font-size:15px;font-weight:700;cursor:pointer;background:#ffb085;color:white;}
            .inv-btn-cancel{width:100%;padding:11px;border:2px solid #FBCBA8;border-radius:10px;
                font-size:14px;font-weight:700;cursor:pointer;background:#FFF0E8;color:#D0784A;}
        </style>
        <div style="text-align:center;">
            <p style="font-size:15px;font-weight:700;color:#C4622A;margin:0;">${tipo}</p>
            <p style="font-size:12px;color:#FBCBA8;margin:4px 0 0;">Disponible: <strong style="color:#D0784A;">${disponible}</strong></p>
        </div>
        <div style="display:flex;gap:8px;">
            <button class="inv-tab-btn activo" id="tab-desc">- Descontar</button>
            <button class="inv-tab-btn"        id="tab-agr">+ Agregar</button>
        </div>
        <div>
            <label style="font-size:12px;font-weight:700;color:#D0784A;" id="inv-label">Cantidad a descontar</label>
            <input type="number" id="inv-input" class="inv-m-input" placeholder="0" min="0.01" step="0.01" style="margin-top:6px;">
            <p id="inv-error" style="font-size:12px;color:#E05555;min-height:16px;margin:4px 0 0;text-align:center;"></p>
        </div>
        <button class="inv-btn-ok"     id="inv-ok">Confirmar</button>
        <button class="inv-btn-cancel" id="inv-cancel">Cancelar</button>
    </div>`;

    document.body.appendChild(overlay);

    // Controlo el modo del modal: descontar o agregar
    let modoAgregar = false;
    const tabDesc = overlay.querySelector('#tab-desc');
    const tabAgr  = overlay.querySelector('#tab-agr');
    const label   = overlay.querySelector('#inv-label');
    const input   = overlay.querySelector('#inv-input');
    const error   = overlay.querySelector('#inv-error');
    const btnOk   = overlay.querySelector('#inv-ok');

    tabDesc.onclick = () => { modoAgregar=false; tabDesc.classList.add('activo'); tabAgr.classList.remove('activo'); label.textContent='Cantidad a descontar'; input.value=''; error.textContent=''; };
    tabAgr.onclick  = () => { modoAgregar=true;  tabAgr.classList.add('activo'); tabDesc.classList.remove('activo'); label.textContent='Cantidad a agregar'; input.value=''; error.textContent=''; };
    overlay.querySelector('#inv-cancel').onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target===overlay) overlay.remove(); };

    // Envío la operación al servidor y recargo el inventario
    btnOk.onclick = async () => {
        const val = parseFloat(input.value);
        error.textContent = '';
        if (isNaN(val)||val<=0) { error.textContent='Ingresa una cantidad válida.'; return; }
        if (!modoAgregar && val>disponible) { error.textContent=`Solo hay ${disponible} disponibles.`; return; }
        btnOk.textContent='Guardando...'; btnOk.disabled=true;
        try {
            const ep  = modoAgregar ? 'agregar' : 'descontar';
            const res = await fetch(`${BASE}/inventario/${ep}/${id}`,
                { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cantidad:val}) });
            const data = await res.json();
            if (!res.ok) { error.textContent=data.mensaje||'Error.'; btnOk.textContent='Confirmar'; btnOk.disabled=false; return; }
            overlay.remove();
            toast(data.mensaje, modoAgregar?'verde':'naranja');
            cargarInventarioAdmin(); cargarResumen();
        } catch { error.textContent='Error al conectar.'; btnOk.textContent='Confirmar'; btnOk.disabled=false; }
    };
    input.focus();
}

// Busco la card del artículo y abro el modal de edición de inventario
window.descontarInventario = function (id, disponible) {
    const card = document.querySelector(`[data-inv-id="${id}"]`);
    abrirModalInventario(id, card?card.dataset.invTipo:'Artículo', disponible);
};

document.addEventListener('DOMContentLoaded', () => {

    // Cargo todo lo necesario al abrir el panel de inicio
    cargarSolicitudes();
    cargarAlertas();
    cargarResumen();
    cargarDonaciones();

    /* ── MENÚ LATERAL ── */
    // Al hacer click en un ítem del menú muestro la sección correspondiente
    const menuItems = document.querySelectorAll('.menu-item a');
    const secciones = document.querySelectorAll('.seccion');

    menuItems.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            menuItems.forEach(i => i.parentElement.classList.remove('activo'));
            this.parentElement.classList.add('activo');
            secciones.forEach(sec => sec.style.display = 'none');
            const id      = this.getAttribute('href').substring(1);
            const destino = document.getElementById(id);
            if (destino) destino.style.display = 'flex';

            // Cargo el contenido de la sección que se abre
            if (id === 'mascotas')   cargarMascotas(sexoActual);
            if (id === 'donaciones') cargarInventarioAdmin();
            if (id === 'inicio')     { cargarSolicitudes(); cargarDonaciones(); cargarAlertas(); cargarResumen(); }
        });
    });

    /* ── SUB-TABS DENTRO DE SECCIONES ── */
    // Cambio entre hembras/machos en mascotas o entre inventario/donaciones
    window.mostrarTab = function (seccion, tab) {
        document.querySelectorAll(`#${seccion} .tab-contenido`).forEach(c => c.style.display = 'none');
        const destino = document.getElementById(tab);
        if (destino) destino.style.display = seccion === 'mascotas' ? 'grid' : 'block';

        const barre = document.querySelector(`#${seccion} .mas-tabs-bar, #${seccion} .donaciones-menu`);
        if (!barre) return;
        const clase   = seccion === 'mascotas' ? 'tab-btn-mas' : 'tab-btn-don';
        const botones = [...barre.querySelectorAll('.' + clase)];
        botones.forEach(b => b.classList.remove('activo'));

        if (seccion === 'mascotas') {
            if (tab === 'hembras') { botones[0]?.classList.add('activo'); cargarMascotas('hembra'); }
            if (tab === 'machos')  { botones[1]?.classList.add('activo'); cargarMascotas('macho'); }
        } else {
            if (tab === 'inventario') { botones[0]?.classList.add('activo'); cargarInventarioAdmin(); }
            else botones[1]?.classList.add('activo');
        }
    };

    /* ── FORMULARIO DONACIÓN ADMIN ── */
    // Bloqueo fechas pasadas en el campo de fecha
    const inputFecha = document.getElementById('donFecha');
    if (inputFecha) inputFecha.min = new Date().toISOString().split('T')[0];

    // Valido y envío el formulario de donación directa del administrador
    document.getElementById('btnEnviarDonacion')?.addEventListener('click', async () => {
        const nombre      = (document.getElementById('donNombre')?.value      ?? '').trim();
        const descripcion = (document.getElementById('donDescripcion')?.value ?? '').trim();
        const cantidad    = parseFloat(document.getElementById('donCantidad')?.value ?? '');
        const unidad      = document.getElementById('donUnidad')?.value  ?? '';
        const fecha       = document.getElementById('donFecha')?.value   ?? '';
        const msg         = document.getElementById('donMsg');

        if (!nombre || !descripcion || !cantidad || !unidad || !fecha) {
            msg.style.color = '#D05A5A'; msg.textContent = 'Completa todos los campos.'; return;
        }
        if (isNaN(cantidad) || cantidad <= 0) {
            msg.style.color = '#D05A5A'; msg.textContent = 'Cantidad inválida.'; return;
        }
        try {
            const res  = await fetch(`${BASE}/donacion-admin`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ nombre, descripcion, cantidad, unidad, fecha })
            });
            const data = await res.json();
            msg.style.color = res.ok ? '#2e7d32' : '#D05A5A';
            msg.textContent = data.mensaje;
            if (res.ok) {
                // Limpio el formulario si todo salió bien
                ['donNombre','donDescripcion','donCantidad','donUnidad','donFecha']
                    .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
                cargarInventarioAdmin(); cargarResumen();
            }
        } catch { msg.style.color='#D05A5A'; msg.textContent='Error al conectar.'; }
    });
});
