/**
 * ============================================================================
 * SUBMIT BUTTON LOADER - Módulo Global
 * ============================================================================
 * Sistema reutilizable para mostrar loading en botones de submit de formularios
 *
 * @author GECKОМERCE
 * @version 1.0.0
 */

export class SubmitButtonLoader {
    /**
     * @param {Object} config - Configuración del loader
     * @param {string} config.formId - ID del formulario (requerido)
     * @param {string} config.buttonId - ID del botón submit (default: 'submitBtn')
     * @param {string} config.loadingText - Texto durante loading (default: 'Guardando...')
     * @param {string} config.loadingIcon - Clase del icono de loading (default: 'ri-loader-4-line')
     */
    constructor(config = {}) {
        // Validar parámetro requerido
        if (!config.formId) {
            console.error('SubmitButtonLoader: formId es requerido');
            return;
        }

        // Configuración con valores por defecto
        this.config = {
            buttonId: 'submitBtn',
            loadingText: 'Guardando...',
            loadingIcon: 'ri-loader-4-line',
            ...config
        };

        // Obtener elementos del DOM
        this.elements = this.getElements();

        // Validar que existen los elementos requeridos
        if (!this.elements.form || !this.elements.button) {
            console.error('SubmitButtonLoader: Formulario o botón no encontrado');
            return;
        }

        // Guardar estado original
        this.originalState = {
            text: this.elements.buttonText ? this.elements.buttonText.textContent : '',
            icon: this.elements.buttonIcon ? this.elements.buttonIcon.className : ''
        };

        // Inicializar
        this.init();
    }

    /**
     * Obtiene referencias a los elementos del DOM
     */
    getElements() {
        const form = document.getElementById(this.config.formId);
        const button = document.getElementById(this.config.buttonId);

        return {
            form: form,
            button: button,
            buttonIcon: button ? button.querySelector('.boton-form-icon i') : null,
            buttonText: button ? button.querySelector('.boton-form-text') : null
        };
    }

    /**
     * Inicializa el event listener del formulario
     */
    init() {
        const { form } = this.elements;

        // Guardar instancia global para que FormValidator pueda accederla
        window.submitLoaderInstance = this;

        // Usar 'submit' event con prioridad baja (se ejecuta después del validador)
        form.addEventListener('submit', (e) => {
            // Solo mostrar loading si el submit no fue prevenido por el validador
            // Usar setTimeout para que se ejecute después del validador
            setTimeout(() => {
                if (!e.defaultPrevented) {
                    this.showLoading();
                }
            }, 0);
        });
    }

    /**
     * Muestra estado de loading en el botón
     */
    showLoading() {
        const { button, buttonIcon, buttonText } = this.elements;

        // Deshabilitar botón
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';

        // Cambiar icono a spinner
        if (buttonIcon) {
            buttonIcon.className = this.config.loadingIcon;
            buttonIcon.style.animation = 'spin 1s linear infinite';
        }

        // Cambiar texto
        if (buttonText) {
            buttonText.textContent = this.config.loadingText;
        }
    }

    /**
     * Restaura el estado original del botón
     */
    resetButton() {
        const { button, buttonIcon, buttonText } = this.elements;

        // Habilitar botón
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';

        // Restaurar icono
        if (buttonIcon) {
            buttonIcon.className = this.originalState.icon;
            buttonIcon.style.animation = '';
        }

        // Restaurar texto
        if (buttonText) {
            buttonText.textContent = this.originalState.text;
        }
    }

    /**
     * Destruye el loader y remueve event listeners
     */
    destroy() {
        this.elements = null;
        this.config = null;
        this.originalState = null;
    }
}

/**
 * Factory function para inicialización rápida
 * @param {Object} config - Configuración del loader
 * @returns {SubmitButtonLoader}
 */
export function initSubmitLoader(config) {
    return new SubmitButtonLoader(config);
}
