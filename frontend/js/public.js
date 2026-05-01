const BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);

    /* ── LOGIN ── */
    const btnLogin    = $('btnLogin');
    const modalLogin  = $('modalLogin');
    const loginError  = $('loginError');
    const loginSubmit = $('loginSubmit');

    if (btnLogin) {
        btnLogin.onclick = () => {
            modalLogin.style.display = 'flex';
            // Limpio errores y bordes al abrir el modal
            if (loginError) {
                loginError.textContent = '';
                loginError.style.cssText = 'display:none;';
            }
            [$('usuario'), $('contrasena')].forEach(el => {
                if (el) el.style.border = '';
            });
        };
    }

    // Cierro el modal con la X
    if ($('closeModal')) {
        $('closeModal').onclick = () => modalLogin.style.display = 'none';
    }

    // Solo cierro clicking fuera si NO está procesando el login
    if (modalLogin) {
        modalLogin.onclick = e => {
            if (e.target === modalLogin && !loginSubmit?.disabled)
                modalLogin.style.display = 'none';
        };
    }

    if (loginSubmit) {
        loginSubmit.onclick = async (e) => {
            e.preventDefault();

            const usuarioInput    = $('usuario');
            const contrasenaInput = $('contrasena');
            const usuario         = usuarioInput?.value.trim();
            const contrasena      = contrasenaInput?.value.trim();

            // Limpio marcas de error previas
            [usuarioInput, contrasenaInput].forEach(el => {
                if (el) el.style.border = '';
            });
            if (loginError) {
                loginError.textContent = '';
                loginError.style.cssText = 'display:none;';
            }

            // Valido campos vacíos y marco cuál falta
            if (!usuario || !contrasena) {
                if (!usuario    && usuarioInput)    usuarioInput.style.border    = '2px solid #E05555';
                if (!contrasena && contrasenaInput) contrasenaInput.style.border = '2px solid #E05555';
                if (loginError) {
                    loginError.textContent = 'Completa todos los campos';
                    loginError.style.cssText = 'display:block;color:#E05555;font-size:13px;font-weight:600;text-align:center;margin-top:6px;padding:8px 12px;background:#fff0f0;border:1.5px solid #ffb3b3;border-radius:8px;';
                }
                return;
            }

            // Bloqueo el botón mientras espera respuesta
            loginSubmit.disabled    = true;
            loginSubmit.textContent = 'Entrando...';

            try {
                const res  = await fetch(BASE + '/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, contrasena })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.mensaje || 'Usuario o contraseña incorrectos');
                }

                localStorage.setItem('logueado', 'true');

                const nombre =
                    data?.usuario?.Nombre ||
                    data?.usuario?.nombre ||
                    data?.nombre ||
                    usuario;

                localStorage.setItem('nombreUsuario', nombre);

                if (data?.usuario?.Rol) {
                    localStorage.setItem('rol', data.usuario.Rol);
                }

                window.location.href = '/admin';

            } catch (err) {
                // Marco ambos inputs en rojo para indicar credenciales incorrectas
                if (usuarioInput)    usuarioInput.style.border    = '2px solid #E05555';
                if (contrasenaInput) contrasenaInput.style.border = '2px solid #E05555';
                if (loginError) {
                    loginError.textContent = err.message;
                    loginError.style.cssText = 'display:block;color:#E05555;font-size:13px;font-weight:600;text-align:center;margin-top:6px;padding:8px 12px;background:#fff0f0;border:1.5px solid #ffb3b3;border-radius:8px;';
                }

                // Restauro el botón a su estado original
                loginSubmit.disabled    = false;
                loginSubmit.textContent = 'Iniciar sesión';
            }
        };
    }

    // Limpio el borde rojo al escribir en cualquier campo del login
    [$('usuario'), $('contrasena')].forEach(inp => {
        inp?.addEventListener('input', () => {
            inp.style.border = '';
            if (loginError) {
                loginError.textContent = '';
                loginError.style.cssText = 'display:none;';
            }
        });
    });

    if ($('contrasena')) {
        $('contrasena').addEventListener('keypress', e => {
            if (e.key === 'Enter') loginSubmit?.click();
        });
    }

    /* ── REGISTRO ── */
    const btnRegistro    = $('btnRegistro');
    const modalRegistro  = $('modalRegistro');
    const registroMsg    = $('registroMsg');
    const registroSubmit = $('registroSubmit');

    if (btnRegistro) {
        btnRegistro.onclick = () => {
            modalRegistro.style.display = 'flex';
            if (registroMsg) registroMsg.textContent = '';
        };
    }

    if ($('closeRegistro')) {
        $('closeRegistro').onclick = () => modalRegistro.style.display = 'none';
    }

    if (modalRegistro) {
        modalRegistro.onclick = e => {
            if (e.target === modalRegistro) modalRegistro.style.display = 'none';
        };
    }

    if (registroSubmit) {
        registroSubmit.onclick = async () => {
            const nombre   = $('regNombre')?.value.trim();
            const password = $('regPassword')?.value.trim();

            if (!nombre || !password) {
                registroMsg.style.color = '#D05A5A';
                registroMsg.textContent = 'Completa todos los campos';
                return;
            }

            registroSubmit.disabled = true;
            registroSubmit.textContent = 'Enviando...';

            try {
                const res  = await fetch(BASE + '/registro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, password })
                });

                const data = await res.json();

                registroMsg.style.color = res.ok ? '#2e7d32' : '#D05A5A';
                registroMsg.textContent = data.mensaje;

                if (res.ok) {
                    $('regNombre').value   = '';
                    $('regPassword').value = '';
                }

            } catch {
                registroMsg.style.color = '#D05A5A';
                registroMsg.textContent = 'Error al conectar con el servidor';
            } finally {
                registroSubmit.disabled = false;
                registroSubmit.textContent = 'Registrarse';
            }
        };
    }

    /* ── MENÚ LATERAL ── */
    const menuItems = document.querySelectorAll('.menu-item a');
    const secciones = document.querySelectorAll('.seccion');

    menuItems.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            menuItems.forEach(i => i.parentElement.classList.remove('activo'));
            this.parentElement.classList.add('activo');

            const seccionId = this.getAttribute('href').substring(1);

            secciones.forEach(sec => {
                sec.classList.remove('activa');
                sec.style.display = '';
            });
            const destino = document.getElementById(seccionId);
            if (destino) destino.classList.add('activa');

            if (this.getAttribute('href') === '#donaciones') cargarInventario();
            if (this.getAttribute('href') === '#mascotas')   cargarMascotas('hembra');
        });
    });

    /* ── SUB-TABS ── */
    window.mostrarTab = function(seccion, tab) {
        document.querySelectorAll(`#${seccion} .tab-contenido`)
            .forEach(c => c.style.display = 'none');

        const destino = document.getElementById(tab);
        if (destino) destino.style.display = 'block';

        const menu = document.querySelector(`#${seccion} .mascotas-menu, #${seccion} .donaciones-menu`);
        if (!menu) return;

        const clase   = seccion === 'mascotas' ? 'tab-btn-mas' : 'tab-btn-don';
        const botones = menu.querySelectorAll('.' + clase);
        botones.forEach(b => b.classList.remove('activo'));

        if (tab === 'hembras' || tab === 'inventario') botones[0]?.classList.add('activo');
        else botones[1]?.classList.add('activo');

        if (tab === 'inventario') cargarInventario();
        if (tab === 'hembras')    cargarMascotas('hembra');
        if (tab === 'machos')     cargarMascotas('macho');
    };

    /* ── MASCOTAS PÚBLICAS ── */
    async function cargarMascotas(sexo) {
        const tabId = sexo === 'hembra' ? 'hembras' : 'machos';
        const grid  = document.getElementById(tabId);
        if (!grid) return;
        grid.innerHTML = '<p class="mas-pub-cargando">Cargando mascotas...</p>';
        try {
            const data = await (await fetch(BASE + '/mascotas?sexo=' + sexo)).json();
            if (!data.length) {
                grid.innerHTML = '<p class="mas-pub-cargando">No hay ' + (sexo === 'hembra' ? 'hembras' : 'machos') + ' en el sistema.</p>';
                return;
            }
            grid.innerHTML = '<div class="mas-pub-lista">' + data.map(m => tarjetaMascotaPub(m)).join('') + '</div>';
        } catch {
            grid.innerHTML = '<p class="mas-pub-cargando">Error al cargar mascotas.</p>';
        }
    }

    function tarjetaMascotaPub(m) {
        const S = {
            verde:    { color: '#4CAF50', label: 'Saludable',          textColor: '#2e7d32' },
            amarilla: { color: '#FFC107', label: 'Atención pendiente', textColor: '#b7680b' },
            roja:     { color: '#E53935', label: 'Cuidado urgente',    textColor: '#b00000' },
            gris:     { color: '#9E9E9E', label: 'Sin seguimiento',    textColor: '#555'    },
        };
        const s = S[m.semaforo] || S.gris;
        const fotoRawPub = m.fotografia || m.Fotografia || '';
        const fotoEl = fotoRawPub
            ? `<img src="${fotoRawPub.startsWith('http') ? fotoRawPub : `${BASE}/${fotoRawPub}`}" alt="${m.Nombre}" class="mas-pub-foto">`
            : `<div class="mas-pub-foto mas-pub-foto-vacia">🐾</div>`;

        const prox = m.prox_cuidado_tipo && m.prox_cuidado_fecha
            ? `<span class="mas-pub-prox"> ${m.prox_cuidado_tipo}: ${m.prox_cuidado_fecha.substring(0,10)}</span>`
            : '';

        return `
        <div class="mas-pub-row" onclick="verDetalleMascota(${m.Id_mascota})" title="Toca para ver más info">
            <div class="mas-pub-semaforo-bar" style="background:transparent;width:0;margin:0;"></div>
            ${fotoEl}
            <div class="mas-pub-info">
                <p class="mas-pub-nombre">${m.Nombre}</p>
                <p class="mas-pub-detalle">
                    ${m.Edad != null ? m.Edad + ' año(s)' : '—'} &nbsp;·&nbsp;
                    ${m.Peso != null ? m.Peso + ' kg' : '—'}
                    ${m.Caracteristicas ? ' &nbsp;·&nbsp; ' + m.Caracteristicas.substring(0,35) + (m.Caracteristicas.length > 35 ? '…' : '') : ''}
                </p>
                ${prox}
            </div>
            <div class="mas-pub-estado" style="color:${s.textColor};background:${s.color}18;">
                <span class="mas-pub-dot" style="background:${s.color};"></span>
                ${s.label}
            </div>
            <div class="mas-pub-ver-btn">Ver info</div>
        </div>`;
    }

    /* ── MODAL DETALLE PÚBLICO ── */
    window.verDetalleMascota = async function(id) {
        let m;
        try {
            const res = await fetch(`${BASE}/mascota/${id}`);
            m = await res.json();
        } catch {
            return;
        }

        const S = {
            verde:    { color: '#4CAF50', label: 'Saludable',          textColor: '#2e7d32' },
            amarilla: { color: '#FFC107', label: 'Atención pendiente', textColor: '#b7680b' },
            roja:     { color: '#E53935', label: 'Cuidado urgente',    textColor: '#b00000' },
            gris:     { color: '#9E9E9E', label: 'Sin seguimiento',    textColor: '#555'    },
        };
        const s = S[m.semaforo] || S.gris;
        const hoy = new Date(); hoy.setHours(0,0,0,0);

        const cuidadosHTML = (m.cuidados && m.cuidados.length)
            ? m.cuidados.map(c => {
                const fp = c.fecha_proxima ? new Date(c.fecha_proxima) : null;
                let badge = '';
                if (fp) {
                    const diff = (fp - hoy) / 86400000;
                    if (diff < 0)       badge = `<span class="mpub-badge mpub-badge-rojo">Vencido</span>`;
                    else if (diff <= 7) badge = `<span class="mpub-badge mpub-badge-amarillo">Próximo</span>`;
                    else                badge = `<span class="mpub-badge mpub-badge-verde">OK</span>`;
                }
                return `<div class="mpub-row">
                    <span class="mpub-tipo">${c.tipo}</span>${badge}
                    <span class="mpub-fecha">Realizado: ${c.fecha ? c.fecha.substring(0,10) : '—'}</span>
                    ${fp ? `<span class="mpub-fecha">Próximo: ${fp.toISOString().substring(0,10)}</span>` : ''}
                    ${c.descripcion ? `<p class="mpub-desc">${c.descripcion}</p>` : ''}
                </div>`;
            }).join('')
            : '<p class="mpub-vacio">Sin cuidados registrados.</p>';

        const segHTML = (m.seguimientos && m.seguimientos.length)
            ? m.seguimientos.slice(0,5).map(sg => {
                const energ = sg.energia != null
                    ? `<span class="mpub-energ" style="background:${sg.energia>=7?'#e8f5e9':sg.energia>=4?'#fff8e1':'#feecec'};color:${sg.energia>=7?'#2e7d32':sg.energia>=4?'#b7680b':'#b00000'};">Energía ${sg.energia}/10</span>`
                    : '';
                return `<div class="mpub-row">
                    <span class="mpub-fecha">${sg.fecha ? sg.fecha.substring(0,10) : '—'}</span>
                    ${sg.comportamiento ? `<span class="mpub-tipo">${sg.comportamiento}</span>` : ''}
                    ${energ}
                    ${sg.notas ? `<p class="mpub-desc">${sg.notas}</p>` : ''}
                </div>`;
            }).join('')
            : '<p class="mpub-vacio">Sin seguimientos recientes.</p>';

        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.5);z-index:9999;
            display:flex;align-items:center;justify-content:center;`;

        overlay.innerHTML = `
        <div style="background:white;border-radius:18px;border:2.5px solid ${s.color};
                    width:min(440px,88vw);max-height:88vh;overflow:hidden;display:flex;flex-direction:column;">
            <style>
                .mpub-tabs{display:flex;border-bottom:1px solid #eee;}
                .mpub-tab{flex:1;padding:11px 0;text-align:center;font-size:13px;font-weight:700;
                    cursor:pointer;border:none;background:transparent;color:#aaa;}
                .mpub-tab.on{color:${s.color};border-bottom:3px solid ${s.color};}
                .mpub-panel{display:none;padding:12px 16px;overflow-y:auto;max-height:calc(88vh - 160px);}
                .mpub-panel.on{display:block;}
                .mpub-row{padding:8px 0;border-bottom:1px solid #f5f5f5;display:flex;flex-wrap:wrap;align-items:center;gap:5px;}
                .mpub-tipo{font-size:13px;font-weight:700;color:#555;}
                .mpub-fecha{font-size:11px;color:#bbb;}
                .mpub-desc{font-size:12px;color:#888;margin:4px 0 0;width:100%;}
                .mpub-vacio{text-align:center;color:#ccc;font-size:13px;margin:16px 0;}
                .mpub-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
                .mpub-badge-rojo{background:#feecec;color:#b00000;}
                .mpub-badge-amarillo{background:#fff8e1;color:#b7680b;}
                .mpub-badge-verde{background:#f1f8e9;color:#2e7d32;}
                .mpub-energ{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
            </style>

            <div style="padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;">
                <div style="width:52px;height:52px;border-radius:50%;border:2.5px solid ${s.color};overflow:hidden;flex-shrink:0;background:#EEE5F5;display:flex;align-items:center;justify-content:center;">
                    ${m.fotografia || m.Fotografia
                        ? `<img src="${(m.fotografia || m.Fotografia).startsWith('http') ? (m.fotografia || m.Fotografia) : `${BASE}/${m.fotografia || m.Fotografia}`}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<span style="font-size:24px;">🐾</span>`}
                </div>
                <div style="flex:1;">
                    <p style="margin:0;font-size:15px;font-weight:800;color:#7B5EA7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${m.Nombre}</p>
                    <p style="margin:0;font-size:12px;color:#aaa;">
                        ${m.Edad != null ? m.Edad + ' años' : '—'} · ${m.Peso != null ? m.Peso + ' kg' : '—'} · ${m.Sexo || '—'}
                    </p>
                </div>
                <div style="display:flex;align-items:center;gap:5px;">
                    <div style="width:10px;height:10px;border-radius:50%;background:${s.color};"></div>
                    <span style="font-size:11px;font-weight:700;color:${s.textColor};">${s.label}</span>
                </div>
                <button onclick="this.closest('[style*=fixed]').remove()"
                    style="background:none;border:none;font-size:20px;cursor:pointer;color:#ccc;line-height:1;padding:0 0 0 8px;">✕</button>
            </div>

            <div class="mpub-tabs">
                <button class="mpub-tab on"  onclick="mpubTab(this,'mpub-info')">Info</button>
                <button class="mpub-tab"     onclick="mpubTab(this,'mpub-cuidados')">Cuidados</button>
                <button class="mpub-tab"     onclick="mpubTab(this,'mpub-seguimiento')">Seguimiento</button>
            </div>

            <div class="mpub-panel on" id="mpub-info">
                ${m.Caracteristicas
                    ? `<p style="font-size:14px;color:#666;line-height:1.6;margin:0;">${m.Caracteristicas}</p>`
                    : '<p style="font-size:13px;color:#ccc;text-align:center;">Sin descripción.</p>'}
            </div>
            <div class="mpub-panel" id="mpub-cuidados">${cuidadosHTML}</div>
            <div class="mpub-panel" id="mpub-seguimiento">${segHTML}</div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    };

    window.mpubTab = function(btn, panelId) {
        const modal = btn.closest('[style*=fixed]');
        modal.querySelectorAll('.mpub-tab').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        modal.querySelectorAll('.mpub-panel').forEach(p => p.classList.remove('on'));
        modal.querySelector('#' + panelId)?.classList.add('on');
    };

    /* ── INVENTARIO PÚBLICO ── */
    async function cargarInventario() {
        const cont = $('inv-pub-lista');
        if (!cont) return;
        cont.innerHTML = '<p class="inv-pub-cargando">Cargando inventario...</p>';
        try {
            const res  = await fetch(BASE + '/inventario');
            const data = await res.json();
            if (!data.length) {
                cont.innerHTML = '<p class="inv-pub-cargando">No hay artículos en el inventario.</p>';
                return;
            }
            cont.innerHTML = data.map(i => `
                <div class="inv-pub-card">
                    <div class="inv-pub-icono">📦</div>
                    <div class="inv-pub-info">
                        <p class="inv-pub-tipo">${i.Tipo}</p>
                        <p class="inv-pub-cantidad">${i.Cantidad} <span>${i.Unidad || 'unidades / kg'}</span></p>
                    </div>
                    <div class="inv-pub-fecha">${i.Fecha ? i.Fecha.substring(0,10) : '—'}</div>
                </div>
            `).join('');
        } catch {
            cont.innerHTML = '<p class="inv-pub-cargando">Error al cargar el inventario.</p>';
        }
    }

    /* ── FORMULARIO DONACIÓN PÚBLICA ── */
    const inputFecha = $('donFecha');
    if (inputFecha) inputFecha.min = new Date().toISOString().split('T')[0];

    document.addEventListener('click', async (e) => {
        if (e.target.id !== 'btnEnviarDonacion') return;

        const nombre      = ($('donNombre')?.value ?? '').trim();
        const descripcion = ($('donDescripcion')?.value ?? '').trim();
        const cantidad    = parseFloat($('donCantidad')?.value ?? '');
        const unidad      = $('donUnidad')?.value ?? '';
        const fecha       = $('donFecha')?.value ?? '';
        const msg         = $('donMsg');

        if (!nombre || !descripcion || !cantidad || !unidad || !fecha) {
            msg.style.color = '#D05A5A';
            msg.textContent = 'Por favor completa todos los campos.';
            return;
        }
        if (isNaN(cantidad) || cantidad <= 0) {
            msg.style.color = '#D05A5A';
            msg.textContent = 'Cantidad inválida.';
            return;
        }

        try {
            const res  = await fetch(BASE + '/donacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, descripcion, cantidad, unidad, fecha })
            });
            const data = await res.json();
            msg.style.color = res.ok ? '#2e7d32' : '#D05A5A';
            msg.textContent = data.mensaje;
            if (res.ok) {
                $('donNombre').value      = '';
                $('donDescripcion').value = '';
                $('donCantidad').value    = '';
                $('donUnidad').value      = '';
                $('donFecha').value       = '';
            }
        } catch {
            msg.style.color = '#D05A5A';
            msg.textContent = 'Error al conectar con el servidor.';
        }
    });

});
