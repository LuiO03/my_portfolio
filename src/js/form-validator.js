// ========================================
// 📋 FORM VALIDATOR - Sistema de Validación Global
// Validación escalable con reglas reutilizables
// ========================================

// Helper: obtener índice visual (#N) para un File dentro de una galería,
// teniendo en cuenta imágenes existentes + nuevas (vista de edición).
function getGalleryFileIndex(field, file, fallbackIndex) {
    if (!field || !file) {
        return typeof fallbackIndex === 'number' ? fallbackIndex + 1 : null;
    }

    try {
        const registries = window._galleryRegistries || {};
        const registry = registries[field.id];
        if (registry && typeof registry.getIndexForFile === 'function') {
            const idx = registry.getIndexForFile(file);
            if (typeof idx === 'number' && idx > 0) {
                return idx; // ya viene 1-based
            }
        }
    } catch (_) {
        // noop: caemos al fallback
    }

    return typeof fallbackIndex === 'number' ? fallbackIndex + 1 : null;
}

class FormValidator {
    constructor(formSelector, options = {}) {
        this.form = document.querySelector(formSelector);
        if (!this.form) {
            console.warn(`❌ Formulario "${formSelector}" no encontrado`);
            return;
        }

        this.options = {
            validateOnBlur: true,
            validateOnInput: false,
            showErrorsInline: true,
            showSuccessIndicators: true, // ✅ NUEVO: Mostrar indicadores de éxito
            preventSubmitOnError: true,
            scrollToFirstError: true,
            errorClass: 'input-error',
            successClass: 'input-success', // ✅ NUEVO: Clase de éxito
            errorMessageClass: 'input-error-message',
            enableSubmit: options.enableSubmit ?? true,
            ...options
        };

        this.fields = new Map();
        this.errors = new Map();

        this.init();
    }

    // ========================================
    // 🚀 INICIALIZACIÓN
    // ========================================
    init() {
        this.scanFields();
        this.attachEventListeners();
        this.setupSingleRequiredWithDependencies();
        console.log('✅ FormValidator inicializado:', this.fields.size, 'campos');
    }

    // ========================================
    // 🔗 DEPENDENCIAS (requiredWith con 1 disparador)
    //
    // Objetivo UX:
    // - Si un campo tiene `requiredWith:campo_principal` (un solo parámetro),
    //   empieza deshabilitado mientras el principal esté vacío.
    // - Se habilita automáticamente al seleccionar/llenar el principal.
    //
    // Nota importante:
    // - `requiredWith` también se usa para grupos interdependientes (CTA). En
    //   esos casos suele tener múltiples disparadores (A depende de B,C; B de A,C; ...).
    //   Para no bloquear esos formularios, SOLO aplicamos auto-disable cuando
    //   el `requiredWith` tiene EXACTAMENTE 1 disparador.
    // ========================================
    setupSingleRequiredWithDependencies() {
        if (!this.form) return;

        const dependencies = [];

        this.fields.forEach((config, dependentField) => {
            if (!config || !Array.isArray(config.rules)) return;

            const rule = config.rules.find(r => r && r.name === 'requiredWith' && r.param);
            if (!rule || !rule.param) return;

            const raw = String(rule.param);
            const triggers = raw.split(',').map(s => s.trim()).filter(Boolean);

            // Solo dependencia 1-a-1
            if (triggers.length !== 1) return;

            const triggerKey = triggers[0];
            const triggerTargets = this.resolveTriggerTargets(triggerKey);
            if (triggerTargets.length === 0) return;

            dependencies.push({
                dependentField,
                triggerKey,
                triggerTargets,
                clearOnTriggerChange: triggerTargets.some(t => (t && t.tagName) ? String(t.tagName).toUpperCase() === 'SELECT' : false),
                lastTriggerValue: null,
            });
        });

        if (dependencies.length === 0) return;

        dependencies.forEach(dep => {
            const update = (reason = 'init') => {
                const triggerValue = this.getTriggerValue(dep.triggerTargets);
                const hasTrigger = triggerValue !== '';

                // Si el disparador está vacío: deshabilitar y limpiar
                if (!hasTrigger) {
                    this.disableDependentField(dep.dependentField);
                    dep.lastTriggerValue = triggerValue;
                    return;
                }

                // Si el disparador tiene valor: habilitar
                this.enableDependentField(dep.dependentField);

                // Si el disparador cambia (solo en eventos change), limpiar dependiente
                // para evitar ambigüedad (ej. tipo de documento cambia y el número ya no aplica).
                if (dep.clearOnTriggerChange && reason === 'change' && dep.lastTriggerValue !== null && triggerValue !== dep.lastTriggerValue) {
                    this.clearFieldValue(dep.dependentField);
                    this.clearError(dep.dependentField);
                    this.clearSuccess(dep.dependentField);
                }

                dep.lastTriggerValue = triggerValue;
            };

            // Estado inicial (incluye valores precargados en edición)
            update('init');

            // Listeners: change + input para cubrir select e inputs
            dep.triggerTargets.forEach(t => {
                if (!(t instanceof HTMLElement)) return;
                t.addEventListener('change', () => update('change'));
                t.addEventListener('input', () => update('input'));
            });
        });
    }

    resolveTriggerTargets(idOrName) {
        const key = String(idOrName || '').trim();
        if (!key) return [];

        // 1) Intentar por id
        const escapedId = (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function')
            ? window.CSS.escape(key)
            : key.replace(/[^a-zA-Z0-9_\-]/g, '');

        const byId = this.form.querySelector(`#${escapedId}`);
        if (byId) return [byId];

        // 2) Intentar por name con elements.namedItem (maneja RadioNodeList)
        let named = null;
        try {
            named = this.form.elements.namedItem(key);
        } catch (_) {
            named = null;
        }

        // 3) Fallback por querySelector name
        if (!named) {
            const byName = this.form.querySelector(`[name="${key.replace(/"/g, '\\"')}"]`);
            return byName ? [byName] : [];
        }

        // RadioNodeList (radios/checkboxes)
        if (typeof RadioNodeList !== 'undefined' && named instanceof RadioNodeList) {
            return Array.from(named).filter(Boolean);
        }

        // Un solo elemento
        if (named instanceof HTMLElement) {
            return [named];
        }

        // Colecciones/array-like
        if (typeof named.length === 'number') {
            return Array.from(named).filter(Boolean);
        }

        return [];
    }

    getTriggerValue(triggerTargets) {
        if (!Array.isArray(triggerTargets) || triggerTargets.length === 0) return '';

        // Si es un grupo (radios/checkboxes con mismo name), considerar el primero que esté checked
        // o el valor del <select> / input.
        for (const el of triggerTargets) {
            if (!(el instanceof HTMLElement)) continue;
            if (el.disabled) continue;

            const tag = (el.tagName || '').toUpperCase();
            const type = (el.getAttribute('type') || '').toLowerCase();

            if (type === 'radio' || type === 'checkbox') {
                if (el.checked) {
                    return String(el.value || '').trim();
                }
                continue;
            }

            if (type === 'file') {
                const files = el.files;
                return files && files.length > 0 ? '__has_file__' : '';
            }

            if (tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'INPUT') {
                return String(el.value || '').trim();
            }
        }

        return '';
    }

    disableDependentField(field) {
        if (!(field instanceof HTMLElement)) return;

        // Ya está deshabilitado: igualmente limpiar estado visual
        if (field.disabled) {
            this.clearError(field);
            this.clearSuccess(field);
            return;
        }

        this.clearFieldValue(field);
        field.disabled = true;
        this.clearError(field);
        this.clearSuccess(field);
    }

    enableDependentField(field) {
        if (!(field instanceof HTMLElement)) return;
        if (!field.disabled) return;

        field.disabled = false;
        this.clearError(field);
        this.clearSuccess(field);
    }

    clearFieldValue(field) {
        if (!(field instanceof HTMLElement)) return;

        const tag = (field.tagName || '').toUpperCase();
        const type = (field.getAttribute('type') || '').toLowerCase();

        if (type === 'file') {
            // Reset FileList
            field.value = '';
            return;
        }

        if (type === 'radio' || type === 'checkbox') {
            field.checked = false;
            return;
        }

        if (tag === 'SELECT') {
            field.value = '';
            if (String(field.value || '') !== '' && field.options && field.options.length > 0) {
                field.selectedIndex = 0;
            }
            return;
        }

        if ('value' in field) {
            field.value = '';
        }
    }

    // ========================================
    // 🔍 ESCANEAR CAMPOS CON data-validate
    // ========================================
    scanFields() {
        // Buscar campos con data-validate explícito
        const explicitInputs = this.form.querySelectorAll('[data-validate]');

        // Buscar campos con required HTML (que no tengan data-validate)
        const requiredInputs = this.form.querySelectorAll('[required]:not([data-validate])');

        // Combinar ambos
        const allInputs = [...explicitInputs, ...requiredInputs];

        allInputs.forEach(input => {
            let rules = [];

            // Si tiene data-validate, parsear
            if (input.dataset.validate) {
                rules = this.parseRules(input.dataset.validate);
            }
            // Si solo tiene required HTML, agregar regla required automática
            else if (input.hasAttribute('required')) {
                rules.push({ name: 'required', param: null });
            }

            const customMessages = input.dataset.validateMessages ?
                JSON.parse(input.dataset.validateMessages) : {};

            // Detectar tipo de campo para getValue correcto
            const getValue = () => {
                if (input.type === 'file') {
                    return input.files;
                }
                return input.value.trim();
            };

            this.fields.set(input, {
                rules,
                customMessages,
                value: getValue,
                // Marcar como requerido si hay reglas equivalentes a "required"
                isRequired: (
                    rules.some(r => ['required', 'requiredText', 'fileRequired', 'selected'].includes(r.name))
                ) || input.hasAttribute('required')
            });
        });
    }

    // ========================================
    // 📝 PARSEAR REGLAS DESDE data-validate
    // ========================================
    parseRules(rulesString) {
        // Formato: "required|email|min:3|max:50"
        return rulesString.split('|').map(rule => {
            const [name, param] = rule.split(':');
            return { name: name.trim(), param: param ? param.trim() : null };
        });
    }

    // ========================================
    // 🎯 ADJUNTAR EVENT LISTENERS
    // ========================================
    attachEventListeners() {
        // Validar en blur (cuando pierde el foco)
        if (this.options.validateOnBlur) {
            this.fields.forEach((config, field) => {
                field.addEventListener('blur', () => {
                    // Si es textarea con CKEditor, sincronizar antes de validar
                    if (field.tagName === 'TEXTAREA') {
                        try {
                            const editors = window._ckEditors || {};
                            const inst = editors[field.id] || window.editorInstance;
                            if (inst && typeof inst.getData === 'function') {
                                field.value = inst.getData();
                            }
                        } catch (_) { /* noop */ }
                    }
                    this.validateField(field);
                });
            });
        }

        // Validar mientras escribe (opcional)
        if (this.options.validateOnInput) {
            this.fields.forEach((config, field) => {
                field.addEventListener('input', () => this.validateField(field));
            });
        }

        // Validación inmediata en inputs de archivo al seleccionar (change)
        // Nota: para inputs dentro de .image-upload-section que usan galería
        // (tienen .preview-container), la validación se dispara manualmente
        // desde gallery-manager, una vez que los previews ya fueron renderizados.
        this.fields.forEach((config, field) => {
            if (field.type === 'file') {
                const uploadSection = typeof field.closest === 'function'
                    ? field.closest('.image-upload-section')
                    : null;

                const isGalleryFile = uploadSection && uploadSection.querySelector('.preview-container');

                // Inputs de archivo "simples" (sin galería) se validan en change
                if (!isGalleryFile) {
                    field.addEventListener('change', () => this.validateField(field));
                }
            }
        });

        // Prevenir submit si hay errores
        if (this.options.preventSubmitOnError) {
            this.form.addEventListener('submit', (e) => {
                // Sincronizar CKEditor -> textarea antes de validar (si existe)
                try {
                    // Sincronizar todos los textareas que tengan instancia CKEditor registrada
                    const editors = window._ckEditors || {};
                    Object.keys(editors).forEach(id => {
                        const ta = this.form.querySelector(`#${id}`);
                        const inst = editors[id];
                        if (ta && inst && typeof inst.getData === 'function') {
                            ta.value = inst.getData();
                        }
                    });
                } catch (_) { /* noop */ }
                const isValid = this.validateAll();

                if (!isValid) {
                    e.preventDefault();
                    e.stopImmediatePropagation(); // Evitar que otros listeners se ejecuten

                    // Resetear submit loader si existe
                    if (window.submitLoaderInstance) {
                        window.submitLoaderInstance.resetButton();
                    }

                    if (this.options.scrollToFirstError) {
                        this.scrollToFirstError();
                    }
                }
                // Si es válido, dejar que el submit continúe normalmente
            });
        }
    }

    // ========================================
    // ✅ VALIDAR UN CAMPO INDIVIDUAL
    // ========================================
    validateField(field) {
        const config = this.fields.get(field);
        if (!config) return true;

        // Saltar validación en campos deshabilitados (ej. dependientes cuando se elige "Yo")
        if (field.disabled) {
            this.clearError(field);
            this.clearSuccess(field);
            return true;
        }

        const value = config.value();
        let isValid = true;
        let errorMessage = null;
        let errorMeta = null;

        // Si el campo es opcional (no required) y está vacío, normalmente se hace skip
        // PERO si tiene reglas de dependencia (ej. requiredWith), se debe evaluar igual
        const isEmpty = field.type === 'file' ? value.length === 0 : value === '';
        // Considerar reglas "required" equivalentes (requiredText, fileRequired, selected)
        const hasRequiredRule = Array.isArray(config.rules) && config.rules.some(r => ['required', 'requiredText', 'fileRequired', 'selected'].includes(r.name));
        // Reglas que necesitan evaluarse aunque el campo esté vacío (campos dependientes)
        const hasDependencyRule = Array.isArray(config.rules) && config.rules.some(r => ['requiredWith'].includes(r.name));
        if (!hasRequiredRule && !config.isRequired && !hasDependencyRule && isEmpty) {
            this.clearError(field);
            return true;
        }

        // Ejecutar cada regla
        for (const rule of config.rules) {
            const validationResult = this.executeRule(rule, value, field);

            if (!validationResult.valid) {
                isValid = false;
                errorMessage = config.customMessages[rule.name] || validationResult.message;
                // Meta opcional: ej. índices de imágenes inválidas en galerías
                errorMeta = {
                    rule: rule.name,
                    invalidIndexes: validationResult.invalidIndexes || null
                };
                break; // Detener en el primer error
            }
        }

        // Actualizar UI
        if (isValid) {
            this.clearError(field);
            this.showSuccess(field); // ✅ NUEVO: Mostrar indicador de éxito
        } else {
            this.clearSuccess(field); // ✅ NUEVO: Limpiar éxito antes de mostrar error
            this.showError(field, errorMessage, errorMeta);
        }

        return isValid;
    }

    // ========================================
    // 🔄 VALIDAR TODOS LOS CAMPOS
    // ========================================
    validateAll() {
        let allValid = true;

        this.fields.forEach((config, field) => {
            const isValid = this.validateField(field);
            if (!isValid) allValid = false;
        });

        return allValid;
    }

    // ========================================
    // ⚙️ EJECUTAR REGLA DE VALIDACIÓN
    // ========================================
    executeRule(rule, value, field) {
        const ruleName = rule.name;
        const param = rule.param;

        // Buscar la regla en el registro
        if (!this.validationRules[ruleName]) {
            console.warn(`⚠️ Regla "${ruleName}" no encontrada`);
            return { valid: true };
        }

        return this.validationRules[ruleName](value, param, field);
    }

    // ========================================
    // 📚 REGLAS DE VALIDACIÓN PREDEFINIDAS
    // ========================================
    validationRules = {
        // === CAMPOS DEPENDIENTES ===
        // Este campo es obligatorio cuando alguno de los campos relacionados tiene valor
        // Parámetro: lista de IDs/names separados por coma (ej: "button_text,button_link,button_style")
        requiredWith: (value, param, field) => {
            if (!param) return { valid: true };

            const relatedFieldIds = param.split(',').map(id => id.trim()).filter(Boolean);
            if (!relatedFieldIds.length) return { valid: true };

            const form = field.closest('form');
            if (!form) return { valid: true };

            // Obtener campos relacionados por id o name
            const relatedFields = relatedFieldIds.map(id => {
                const f = form.querySelector(`#${id}, [name="${id}"]`);
                return f ? { id, field: f, value: (f.value || '').trim() } : null;
            }).filter(Boolean);

            if (!relatedFields.length) return { valid: true };

            // ¿Alguno de los campos relacionados tiene valor?
            const anyRelatedHasValue = relatedFields.some(f => f.value !== '');
            if (!anyRelatedHasValue) {
                // Nadie del grupo disparador tiene valor: este campo sigue siendo opcional
                return { valid: true };
            }

            // Si este campo tiene valor, pasa la regla
            if ((value || '').trim() !== '') {
                return { valid: true };
            }

            // Construir etiquetas legibles de los campos que disparan la dependencia
            const triggeringFields = relatedFields.filter(f => f.value !== '');
            const labels = triggeringFields.map(f => {
                const label = form.querySelector(`label[for="${f.id}"]`);
                return label ? label.textContent.trim().replace(/\*/g, '') : f.id;
            });

            return {
                valid: false,
                message: `Este campo es requerido cuando se completa: ${labels.join(', ')}`
            };
        },

        // === SOLO IMAGEN ÚNICA ===
        imageSingle: (files, _param, field) => {
                            if (!files || files.length === 0) return { valid: true };
                            const file = files[0];
                            const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                            const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                            const mime = (file.type || '').toLowerCase();
                            const ext = (file.name.split('.').pop() || '').toLowerCase();
                            if (!(allowedMimes.includes(mime) || allowedExts.includes(ext))) {
                                return {
                                    valid: false,
                                    message: 'Solo se permite una imagen JPG, PNG, GIF o WebP'
                                };
                            }
                            return { valid: true };
                        },
                // === COLOR HEX ===
                colorHex: (value) => {
                    if (!value) return { valid: true };
                    return {
                        valid: /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(value),
                        message: 'Debe ser un color HEX válido (#RRGGBB o #RGB)'
                    };
                },

                // === COLOR RGB ===
                colorRgb: (value) => {
                    if (!value) return { valid: true };
                    return {
                        valid: /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.test(value),
                        message: 'Debe ser un color RGB válido (rgb(255,255,255))'
                    };
                },

                // === COLOR RGBA ===
                colorRgba: (value) => {
                    if (!value) return { valid: true };
                    return {
                        valid: /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(value),
                        message: 'Debe ser un color RGBA válido (rgba(255,255,255,1))'
                    };
                },

                // === COLOR CSS (hex, rgb, rgba, hsl, hsla, palabras clave) ===
                colorCss: (value) => {
                    if (!value) return { valid: true };
                    // Permite hex, rgb, rgba, hsl, hsla y palabras clave CSS
                    const cssColorRegex = /^(#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)|hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(0|1|0?\.\d+)\s*\)|[a-zA-Z]+)$/;
                    return {
                        valid: cssColorRegex.test(value),
                        message: 'Debe ser un color CSS válido (hex, rgb, rgba, hsl, hsla o nombre)'
                    };
                },
        // === OBLIGATORIO ===
        required: (value) => ({
            valid: value.length > 0,
            message: 'Este campo es obligatorio'
        }),

        // === OBLIGATORIO (solo texto visible; ignora etiquetas HTML/espacios) ===
        requiredText: (value) => {
            if (!value) return { valid: false, message: 'Este campo es obligatorio' };
            const div = document.createElement('div');
            div.innerHTML = value;
            let text = (div.textContent || div.innerText || '').replace(/\u00A0|&nbsp;/g, ' ').trim();
            return {
                valid: text.length > 0,
                message: 'Este campo es obligatorio'
            };
        },

        // === EMAIL ===
        email: (value) => {
            if (!value) return { valid: true }; // Skip si está vacío (usar required para obligar)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return {
                valid: emailRegex.test(value),
                message: 'Ingrese un correo electrónico válido'
            };
        },

        // === LONGITUD MÍNIMA ===
        min: (value, param) => ({
            valid: value.length >= parseInt(param),
            message: `Debe tener al menos ${param} caracteres`
        }),

        // === LONGITUD MÍNIMA (solo texto visible; ignora HTML) ===
        minText: (value, param) => {
            const p = parseInt(param);
            const div = document.createElement('div');
            div.innerHTML = value || '';
            let text = (div.textContent || div.innerText || '').replace(/\u00A0|&nbsp;/g, ' ').trim();
            return {
                valid: text.length >= p,
                message: `Debe tener al menos ${param} caracteres`
            };
        },

        // === LONGITUD MÁXIMA ===
        max: (value, param) => ({
            valid: value.length <= parseInt(param),
            message: `No puede exceder ${param} caracteres`
        }),

        // === LONGITUD EXACTA ===
        length: (value, param) => ({
            valid: value.length === parseInt(param),
            message: `Debe tener exactamente ${param} caracteres`
        }),

        // === SOLO NÚMEROS ===
        numeric: (value) => {
            if (!value) return { valid: true };
            return {
                valid: /^\d+$/.test(value),
                message: 'Solo se permiten números'
            };
        },

        // === SOLO LETRAS ===
        alpha: (value) => {
            if (!value) return { valid: true };
            return {
                valid: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value),
                message: 'Solo se permiten letras'
            };
        },

        // === ALFANUMÉRICO (debe contener al menos una letra) ===
        alphanumeric: (value) => {
            if (!value) return { valid: true };
            // Primero valida que solo tenga letras, números y espacios
            const onlyValidChars = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/.test(value);
            // Luego valida que contenga al menos una letra
            const hasLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(value);
            return {
                valid: onlyValidChars && hasLetter,
                message: 'Debe contener al menos una letra'
            };
        },

        // === DNI PERUANO (8 dígitos) ===
        dni: (value) => {
            if (!value) return { valid: true };
            return {
                valid: /^\d{8}$/.test(value),
                message: 'El DNI debe tener 8 dígitos'
            };
        },

        // === RUC PERUANO (11 dígitos) ===
        ruc: (value) => {
            if (!value) return { valid: true };
            return {
                valid: /^\d{11}$/.test(value),
                message: 'El RUC debe tener 11 dígitos'
            };
        },

        // === NÚMERO DE DOCUMENTO SEGÚN TIPO SELECCIONADO ===
        // Depende de un select en el mismo formulario con id="document_type" o name="document_type"
        document_number: (value, _param, field) => {
            if (!value) return { valid: true };

            const form = field.closest('form');
            if (!form) return { valid: true };

            const typeField = form.querySelector('#document_type, [name="document_type"]');
            const docType = typeField ? String(typeField.value || '').toUpperCase() : '';

            const clean = value.replace(/\s+/g, '');

            if (!docType) {
                return {
                    valid: false,
                    message: 'Seleccione un tipo de documento'
                };
            }

            // Reglas específicas por tipo
            if (docType === 'DNI') {
                const isValid = /^\d{8}$/.test(clean);
                return {
                    valid: isValid,
                    message: 'El DNI debe tener 8 dígitos'
                };
            }

            if (docType === 'RUC') {
                const isValid = /^\d{11}$/.test(clean);
                return {
                    valid: isValid,
                    message: 'El RUC debe tener 11 dígitos'
                };
            }

            // CE o PASAPORTE: permitir letras y números, 6-15 caracteres
            if (docType === 'CE' || docType === 'PASAPORTE') {
                const isValid = /^[A-Za-z0-9]{6,15}$/.test(clean);
                return {
                    valid: isValid,
                    message: 'Debe tener entre 6 y 15 caracteres (letras y números)'
                };
            }

            // Si llega un tipo no controlado, no bloquear
            return { valid: true };
        },

        // === TELÉFONO PERUANO (9 dígitos, empieza con 9, solo números, sin espacios ni símbolos) ===
        phone: (value) => {
            if (!value) return { valid: true };
            // Quitar espacios y caracteres no numéricos
            const cleanValue = value.replace(/\D/g, '');
            if (value.match(/[^\d]/)) {
                return {
                    valid: false,
                    message: 'El número solo debe contener dígitos, sin espacios ni símbolos'
                };
            }
            if (cleanValue.length !== 9) {
                return {
                    valid: false,
                    message: 'El número debe tener exactamente 9 dígitos'
                };
            }
            if (!cleanValue.startsWith('9')) {
                return {
                    valid: false,
                    message: 'El número debe iniciar con 9'
                };
            }
            // No permitir todos los dígitos iguales (ej: 999999999)
            if (/^(\d)\1{8}$/.test(cleanValue)) {
                return {
                    valid: false,
                    message: 'El número no puede tener todos los dígitos iguales'
                };
            }
            // No permitir secuencias ascendentes o descendentes simples (ej: 912345678, 987654321)
            const secuenciasInvalidas = [
                '912345678', '987654321', '900000000', '911111111', '922222222', '933333333', '944444444', '955555555', '966666666', '977777777', '988888888', '999999999'
            ];
            if (secuenciasInvalidas.includes(cleanValue)) {
                return {
                    valid: false,
                    message: 'El número ingresado no es válido o es un patrón no permitido'
                };
            }
            return {
                valid: true,
                message: ''
            };
        },

        // === TELÉFONO INTERNACIONAL FLEXIBLE (dígitos, espacios, +, - y paréntesis) ===
        phoneIntl: (value) => {
            if (!value) return { valid: true };
            const allowedChars = /^[0-9+\s()\-]+$/.test(value);
            const digitsCount = (value.match(/\d/g) || []).length;
            return {
                valid: allowedChars && digitsCount >= 6,
                message: 'Ingrese un teléfono válido (solo números, espacios, +, -, paréntesis y al menos 6 dígitos)'
            };
        },

        // === URL ===
        url: (value) => {
            if (!value) return { valid: true };

            const raw = String(value).trim();
            if (!raw) return { valid: true };

            // Permitir que el usuario omita el protocolo (ej: "empresa.com")
            const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
            const candidate = hasScheme ? raw : `https://${raw}`;

            try {
                const parsed = new URL(candidate);
                const hostname = parsed.hostname || '';

                // Permitir localhost e IPs para entornos de desarrollo
                const isLocalhost = hostname === 'localhost';
                const isIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

                if (!isLocalhost && !isIPv4) {
                    // Dominio con al menos un punto y TLD alfabético (2+ letras)
                    const hostnameRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
                    if (!hostnameRegex.test(hostname)) {
                        return {
                            valid: false,
                            message: 'Ingrese una URL válida (incluya un dominio y extensión correctos)'
                        };
                    }

                    // Lista corta de TLD claramente inválidos por error de tipeo
                    const tld = hostname.split('.').pop().toLowerCase();
                    const invalidTlds = ['comm'];
                    if (invalidTlds.includes(tld)) {
                        return {
                            valid: false,
                            message: 'La extensión del dominio parece incorrecta. Ejemplo válido: .com, .net, .org'
                        };
                    }
                }

                return { valid: true };
            } catch {
                return {
                    valid: false,
                    message: 'Ingrese una URL válida'
                };
            }
        },

        // === VALOR MÍNIMO (NUMÉRICO) ===
        minValue: (value, param) => {
            const numValue = parseFloat(value);
            return {
                valid: !isNaN(numValue) && numValue >= parseFloat(param),
                message: `El valor mínimo es ${param}`
            };
        },

        // === VALOR MÁXIMO (NUMÉRICO) ===
        maxValue: (value, param) => {
            const numValue = parseFloat(value);
            return {
                valid: !isNaN(numValue) && numValue <= parseFloat(param),
                message: `El valor máximo es ${param}`
            };
        },

        // === SELECT OBLIGATORIO (excluye value="") ===
        selected: (value, param, field) => {
            // Para <select>, verifica que no sea la opción disabled
            return {
                valid: value !== '' && value !== null,
                message: 'Debe seleccionar una opción'
            };
        },

        // === CONFIRMAR (COMPARAR CON OTRO CAMPO) ===
        confirmed: (value, param, field) => {
            const confirmField = document.querySelector(`#${param}`);
            if (!confirmField) {
                console.warn(`⚠️ Campo de confirmación "#${param}" no encontrado`);
                return { valid: true };
            }
            return {
                valid: value === confirmField.value.trim(),
                message: 'Los campos no coinciden'
            };
        },

        // === PATRÓN REGEX PERSONALIZADO ===
        pattern: (value, param) => {
            if (!value) return { valid: true };
            const regex = new RegExp(param);
            return {
                valid: regex.test(value),
                message: 'El formato no es válido'
            };
        },

        // ========================================
        // 📁 VALIDACIONES DE ARCHIVOS/IMÁGENES
        // ========================================

        // === ARCHIVO / GALERÍA REQUERIDO ===
        // Para galerías de imágenes (.image-upload-section), considera
        // tanto imágenes existentes como nuevas (preview-item en el DOM).
        fileRequired: (files, _param, field) => {
            if (field && typeof field.closest === 'function') {
                const gallerySection = field.closest('.image-upload-section');
                if (gallerySection) {
                    const previewContainer = gallerySection.querySelector('.preview-container');
                    const totalItems = previewContainer
                        ? previewContainer.querySelectorAll('.preview-item').length
                        : 0;

                    // Si aún no hay previews en el DOM pero sí hay archivos
                    // seleccionados (FileList con longitud > 0), asumimos que
                    // la galería es válida. Esto evita falsos negativos justo
                    // en el momento en que gallery-manager reconstruye la
                    // FileList antes de que los <div.preview-item> se monten.
                    if (totalItems === 0 && files && files.length > 0) {
                        return { valid: true };
                    }

                    // Caso normal: en vistas de edición o cuando el DOM ya
                    // fue actualizado, se valida contra el total de previews
                    // (existentes + nuevas).
                    return {
                        valid: totalItems > 0,
                        message: 'Debe subir al menos una imagen'
                    };
                }
            }

            const hasFiles = files && files.length > 0;
            return {
                valid: hasFiles,
                message: 'Debe seleccionar al menos un archivo'
            };
        },

        // === TAMAÑO MÁXIMO (en KB) ===
        maxSize: (files, param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const maxSizeKB = parseInt(param);
            const list = Array.from(files);
            const invalidFiles = list.filter(f => (f.size / 1024) > maxSizeKB);

            if (invalidFiles.length === 0) {
                return { valid: true };
            }

            // Índices basados en la posición visual dentro de la galería (si existe)
            let indexes = invalidFiles
                .map(f => {
                    const rawIndex = list.indexOf(f);
                    return getGalleryFileIndex(field, f, rawIndex);
                })
                .filter(i => i > 0);

            if (indexes.length > 0) {
                const plural = indexes.length > 1;
                const sujeto = plural ? 'Las imágenes' : 'La imagen';
                const verbo = plural ? 'no deben' : 'no debe';
                const etiquetas = indexes.map(i => `#${i}`).join(', ');
                return {
                    valid: false,
                    message: `${sujeto} ${etiquetas} ${verbo} exceder ${maxSizeKB}KB`,
                    invalidIndexes: indexes
                };
            }

            // Fallback genérico por archivo
            const invalidFile = invalidFiles[0];
            const fileSizeKB = invalidFile.size / 1024;
            return {
                valid: false,
                message: `El archivo "${invalidFile.name}" no debe exceder ${maxSizeKB}KB (actual: ${Math.round(fileSizeKB)}KB)`
            };
        },

        // === TAMAÑO MÁXIMO (GALERÍA, en MB) ===
        maxSizeMB: (files, param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const maxSizeMB = parseFloat(param);
            const list = Array.from(files);
            const invalidFiles = list.filter(f => (f.size / (1024 * 1024)) > maxSizeMB);
            if (invalidFiles.length === 0) {
                return { valid: true };
            }
            const indexes = invalidFiles
                .map(f => {
                    const rawIndex = list.indexOf(f);
                    return getGalleryFileIndex(field, f, rawIndex);
                })
                .filter(i => i > 0);
            if (indexes.length > 0) {
                const plural = indexes.length > 1;
                const sujeto = plural ? 'Las imágenes' : 'La imagen';
                const verbo = plural ? 'no deben' : 'no debe';
                const etiquetas = indexes.map(i => `#${i}`).join(', ');
                return {
                    valid: false,
                    message: `${sujeto} ${etiquetas} ${verbo} exceder ${maxSizeMB}MB`,
                    invalidIndexes: indexes
                };
            }
            const invalidFile = invalidFiles[0];
            const fileSizeMB = invalidFile.size / (1024 * 1024);
            return {
                valid: false,
                message: `El archivo "${invalidFile.name}" no debe exceder ${maxSizeMB}MB (actual: ${fileSizeMB.toFixed(2)}MB)`
            };
        },

        // === TAMAÑO MÁXIMO (IMAGEN ÚNICA, en MB) ===
        maxSizeSingleMB: (files, param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const maxSizeMB = parseFloat(param);
            const file = files[0];
            if ((file.size / (1024 * 1024)) > maxSizeMB) {
                const fileSizeMB = file.size / (1024 * 1024);
                return {
                    valid: false,
                    message: `La imagen no debe exceder ${maxSizeMB}MB (actual: ${fileSizeMB.toFixed(2)}MB)`
                };
            }
            return { valid: true };
        },

        // === TIPOS DE ARCHIVO PERMITIDOS ===
        fileTypes: (files, param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const allowedTypes = param.split(',').map(t => t.trim().toLowerCase());
            const list = Array.from(files);
            const invalidFiles = list.filter(f => {
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                return !allowedTypes.includes(ext);
            });

            if (invalidFiles.length === 0) {
                return { valid: true };
            }

            const indexes = invalidFiles
                .map(f => {
                    const rawIndex = list.indexOf(f);
                    return getGalleryFileIndex(field, f, rawIndex);
                })
                .filter(i => i > 0);

            if (indexes.length > 0) {
                const plural = indexes.length > 1;
                const sujeto = plural ? 'Las imágenes' : 'La imagen';
                const verbo = plural ? 'tienen' : 'tiene';
                const etiquetas = indexes.map(i => `#${i}`).join(', ');
                return {
                    valid: false,
                    message: `${sujeto} ${etiquetas} ${verbo} extensión no permitida. Solo se permiten: ${allowedTypes.join(', ')}`,
                    invalidIndexes: indexes
                };
            }

            const invalidFile = invalidFiles[0];
            const fileExtension = (invalidFile.name.split('.').pop() || '').toLowerCase();
            return {
                valid: false,
                message: `El archivo "${invalidFile.name}" tiene extensión .${fileExtension} no permitida. Solo se permiten: ${allowedTypes.join(', ')}`
            };
        },

        // === MIME TYPES PERMITIDOS ===
        mimeTypes: (files, param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const allowedMimes = param.split(',').map(m => m.trim().toLowerCase());
            const list = Array.from(files);
            const invalidFiles = list.filter(f => {
                const mime = (f.type || '').toLowerCase();
                return mime && !allowedMimes.includes(mime);
            });

            if (invalidFiles.length === 0) {
                return { valid: true };
            }

            const indexes = invalidFiles
                .map(f => {
                    const rawIndex = list.indexOf(f);
                    return getGalleryFileIndex(field, f, rawIndex);
                })
                .filter(i => i > 0);

            if (indexes.length > 0) {
                const plural = indexes.length > 1;
                const sujeto = plural ? 'Las imágenes' : 'La imagen';
                const etiquetas = indexes.map(i => `#${i}`).join(', ');
                return {
                    valid: false,
                    message: `${sujeto} ${etiquetas} tienen un tipo de archivo no permitido. Solo: ${allowedMimes.join(', ')}`,
                    invalidIndexes: indexes
                };
            }

            const invalidFile = invalidFiles[0];
            const mime = (invalidFile.type || '').toLowerCase();
            return {
                valid: false,
                message: `El archivo "${invalidFile.name}" es de tipo ${mime || 'desconocido'}, no permitido. Solo: ${allowedMimes.join(', ')}`
            };
        },

        // === SOLO IMÁGENES ===
        image: (files, _param, field) => {
            if (!files || files.length === 0) return { valid: true };
            const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

            const list = Array.from(files);
            const invalidFiles = list.filter(file => {
                const mime = (file.type || '').toLowerCase();
                const byMime = mime ? allowedMimes.includes(mime) : false;
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                const byExt = allowedExts.includes(ext);
                return !(byMime || (!mime && byExt));
            });

            if (invalidFiles.length === 0) {
                return { valid: true };
            }

            const indexes = invalidFiles
                .map(f => {
                    const rawIndex = list.indexOf(f);
                    return getGalleryFileIndex(field, f, rawIndex);
                })
                .filter(i => i > 0);

            if (indexes.length > 0) {
                const plural = indexes.length > 1;
                const sujeto = plural ? 'Las imágenes' : 'La imagen';
                const etiquetas = indexes.map(i => `#${i}`).join(', ');
                return {
                    valid: false,
                    message: `${sujeto} ${etiquetas} no son imágenes válidas. Solo se permiten imágenes (JPG, PNG, GIF, WebP)`,
                    invalidIndexes: indexes
                };
            }

            const invalidFile = invalidFiles[0];
            return {
                valid: false,
                message: `El archivo "${invalidFile.name}" no es una imagen válida. Solo se permiten imágenes (JPG, PNG, GIF, WebP)`
            };
        },

        // === MÁXIMO NÚMERO DE ARCHIVOS ===
        // En galerías de imágenes de edición, cuenta imágenes existentes + nuevas
        maxFiles: (files, param, field) => {
            const max = parseInt(param);

            // Intentar contar desde el DOM de la galería (imágenes existentes + nuevas)
            let total = 0;
            if (field && typeof field.closest === 'function') {
                const gallerySection = field.closest('.image-upload-section');
                if (gallerySection) {
                    const previewContainer = gallerySection.querySelector('.preview-container');
                    if (previewContainer) {
                        total = previewContainer.querySelectorAll('.preview-item').length;
                    }
                }
            }

            // Fallback: si no hay galería asociada, usar solo el FileList
            if (!total && files) {
                total = files.length;
            }

            // Si sigue siendo 0, no hay archivos que validar
            if (!total) return { valid: true };

            return {
                valid: total <= max,
                message: `No puede seleccionar más de ${max} archivos (actual: ${total})`
            };
        },

        // === DIMENSIONES DE IMAGEN (requiere carga asíncrona) ===
        // Nota: Esta validación es síncrona, para dimensiones usar un método especial
        maxDimensions: (files, param) => {
            // Esta regla necesita validación asíncrona
            // Se implementa por separado si es necesario
            return { valid: true };
        }
    };

    // ========================================
    // ✅ MOSTRAR ÉXITO
    // ========================================
    showSuccess(field) {
        if (!this.options.showSuccessIndicators) return;

        // Agregar clase de éxito al input
        field.classList.add(this.options.successClass);
        field.classList.remove(this.options.errorClass);

        // Si es textarea con CKEditor, aplicar clase al editable y wrapper
        if (field.tagName === 'TEXTAREA') {
            const group = field.closest('.input-group');
            const editable = group ? group.querySelector('.ck-editor__editable') : null;
            if (editable) {
                editable.classList.add(this.options.successClass);
                editable.classList.remove(this.options.errorClass);
            }
            const wrapper = group ? group.querySelector('.ck-editor') : null;
            if (wrapper) {
                wrapper.classList.add(this.options.successClass);
                wrapper.classList.remove(this.options.errorClass);
            }
        }

        console.log(`✅ Success aplicado a:`, field.tagName, field.name || field.id, `Clases:`, field.className);

        // Agregar icono de check en inputs, selects y textareas (no en files)
        if (field.type !== 'file') {
            const parent = field.closest('.input-icon-container');
            if (parent && !parent.querySelector('.validation-check-icon')) {
                const checkIcon = document.createElement('i');
                checkIcon.className = 'ri-checkbox-circle-fill validation-check-icon';
                parent.appendChild(checkIcon);
                console.log(`✅ Check icon agregado`);
            }
        } else {
            console.log(`⚠️ No se agrega check (es FILE)`);
        }
    }

    // ========================================
    // ❌ LIMPIAR ÉXITO
    // ========================================
    clearSuccess(field) {
        field.classList.remove(this.options.successClass);

        const parent = field.closest('.input-icon-container');
        if (parent) {
            const checkIcon = parent.querySelector('.validation-check-icon');
            if (checkIcon) {
                checkIcon.remove();
            }
        }

        // Limpiar clases de CKEditor si aplica
        if (field.tagName === 'TEXTAREA') {
            const group = field.closest('.input-group');
            const editable = group ? group.querySelector('.ck-editor__editable') : null;
            if (editable) {
                editable.classList.remove(this.options.successClass);
            }
            const wrapper = group ? group.querySelector('.ck-editor') : null;
            if (wrapper) {
                wrapper.classList.remove(this.options.successClass);
            }
        }
    }

    // ========================================
    // ❌ MOSTRAR ERROR
    // ========================================
    showError(field, message, meta = null) {
        this.errors.set(field, message);

        // Agregar clase de error al input
        field.classList.add(this.options.errorClass);
        field.classList.remove(this.options.successClass); // ✅ NUEVO: Quitar clase de éxito

        // Si es textarea con CKEditor, aplicar clase al editable y wrapper
        if (field.tagName === 'TEXTAREA') {
            const group = field.closest('.input-group');
            const editable = group ? group.querySelector('.ck-editor__editable') : null;
            if (editable) {
                editable.classList.add(this.options.errorClass);
                editable.classList.remove(this.options.successClass);
            }
            const wrapper = group ? group.querySelector('.ck-editor') : null;
            if (wrapper) {
                wrapper.classList.add(this.options.errorClass);
                wrapper.classList.remove(this.options.successClass);
            }
        }

        if (!this.options.showErrorsInline) return;

        // Buscar posible contenedor especial (galería de imágenes)
        const gallerySection = field.type === 'file'
            ? field.closest('.image-upload-section')
            : null;

        // Buscar o crear mensaje de error
        const parent = field.closest('.input-group') || field.parentElement;
        let errorElement = parent.querySelector(`.${this.options.errorMessageClass}`);

        // Si no se encontró en el parent estándar y es galería, buscar en toda la sección
        if (!errorElement && gallerySection) {
            errorElement = gallerySection.querySelector(`.${this.options.errorMessageClass}`);
        }

        if (!errorElement) {
            errorElement = document.createElement('span');
            errorElement.className = this.options.errorMessageClass;
            errorElement.innerHTML = `<Icon name="tabler:alert-circle" /> <span class="error-text"></span>`;

            // Caso especial: inputs de archivo de galería
            if (gallerySection) {
                const mediaLayout = gallerySection.querySelector('.gallery-media-layout');
                if (mediaLayout && mediaLayout.parentNode) {
                    // Insertar el mensaje debajo del layout para no romper el grid interno
                    mediaLayout.after(errorElement);
                } else {
                    // Fallback si por alguna razón no existe el layout
                    field.after(errorElement);
                }
            } else {
                // Caso general: después del input-icon-container o después del campo
                const container = field.closest('.input-icon-container');
                if (container) {
                    container.after(errorElement);
                } else {
                    field.after(errorElement);
                }
            }
        }

        errorElement.querySelector('.error-text').textContent = message;
        errorElement.style.display = 'flex';

        // Marcar previews de galería que están involucradas en el error
        if (field.type === 'file' && gallerySection) {
            const previewContainer = gallerySection.querySelector('.preview-container');
            if (previewContainer) {
                // Limpiar marcas previas
                previewContainer.querySelectorAll('.preview-item.image-error-state').forEach(item => {
                    item.classList.remove('image-error-state');
                });

                // Aplicar marcas nuevas según índices inválidos (si los hay)
                const indexes = meta && Array.isArray(meta.invalidIndexes)
                    ? meta.invalidIndexes
                    : null;

                if (indexes && indexes.length > 0) {
                    const items = Array.from(previewContainer.querySelectorAll('.preview-item'));
                    indexes.forEach(idx => {
                        const pos = idx - 1;
                        if (pos >= 0 && pos < items.length) {
                            items[pos].classList.add('image-error-state');
                        }
                    });
                }
            }
        }
    }

    // ========================================
    // ✅ LIMPIAR ERROR
    // ========================================
    clearError(field) {
        this.errors.delete(field);
        field.classList.remove(this.options.errorClass);

        const parent = field.closest('.input-group') || field.parentElement;
        let errorElement = parent.querySelector(`.${this.options.errorMessageClass}`);

        // Caso especial: inputs de archivo asociados a galería
        if (!errorElement && field.type === 'file') {
            const gallerySection = field.closest('.image-upload-section');
            if (gallerySection) {
                errorElement = gallerySection.querySelector(`.${this.options.errorMessageClass}`);
            }
        }

        if (errorElement) {
            errorElement.style.display = 'none';
        }

        // Limpiar marcas de error en previews de galería
        if (field.type === 'file') {
            const gallerySection = field.closest('.image-upload-section');
            if (gallerySection) {
                const previewContainer = gallerySection.querySelector('.preview-container');
                if (previewContainer) {
                    previewContainer.querySelectorAll('.preview-item.image-error-state').forEach(item => {
                        item.classList.remove('image-error-state');
                    });
                }
            }
        }

        // Limpiar clases de CKEditor si aplica
        if (field.tagName === 'TEXTAREA') {
            const group = field.closest('.input-group');
            const editable = group ? group.querySelector('.ck-editor__editable') : null;
            if (editable) {
                editable.classList.remove(this.options.errorClass);
            }
            const wrapper = group ? group.querySelector('.ck-editor') : null;
            if (wrapper) {
                wrapper.classList.remove(this.options.errorClass);
            }
        }
    }

    // ========================================
    // 📍 SCROLL AL PRIMER ERROR
    // ========================================
    scrollToFirstError() {
        const firstErrorField = Array.from(this.errors.keys())[0];
        if (firstErrorField) {
            const scrollTarget = firstErrorField.closest('.input-group, .image-upload-section, .file-group, .form-row, .form-column') || firstErrorField;
            if (scrollTarget instanceof HTMLElement) {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            const isHidden = firstErrorField instanceof HTMLElement ? firstErrorField.offsetParent === null : false;
            if (!isHidden && firstErrorField.focus) {
                firstErrorField.focus();
                return;
            }

            const focusable = scrollTarget instanceof HTMLElement
                ? scrollTarget.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
                : null;

            if (focusable && focusable.focus) {
                focusable.focus();
            }
        }
    }

    // ========================================
    // 🔧 AGREGAR REGLA PERSONALIZADA
    // ========================================
    addRule(name, validationFunction) {
        this.validationRules[name] = validationFunction;
        console.log(`✅ Regla personalizada "${name}" agregada`);
    }

    // ========================================
    // 🔄 RESETEAR FORMULARIO
    // ========================================
    reset() {
        this.errors.clear();
        this.fields.forEach((config, field) => {
            this.clearError(field);
            this.clearSuccess(field); // ✅ NUEVO: Limpiar también éxitos
        });
    }
}

// ========================================
// 📤 EXPORTAR CLASE Y FUNCIÓN HELPER
// ========================================
export default FormValidator;

// Función helper para inicialización rápida
export function initFormValidator(formSelector, options = {}) {
    const validator = new FormValidator(formSelector, options);

    // === Habilitar botón submit solo si hay cambios en formularios de edición ===
    const form = document.querySelector(formSelector);
    if (!form) return validator;

    // Exponer instancia en el formulario para integraciones externas (galerías, etc.)
    // Permite que otros módulos puedan forzar la revalidación de campos concretos.
    form.__validator = validator;

    // Nota: se eliminó la lógica de deshabilitar el botón submit hasta que haya cambios,
    // porque generaba problemas en algunos formularios (como direcciones de envío) y
    // bloqueaba envíos válidos. Ahora el control del botón submit queda a cargo del
    // propio formulario o de otros módulos específicos.

    return validator;
}
