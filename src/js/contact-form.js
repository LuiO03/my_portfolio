import { initFormValidator } from "./form-validator.js";
import { initTextareaAutosize } from "./textarea-autosize.js";
import { initSubmitLoader } from "./submit-button-loader.js";

document.addEventListener("astro:page-load", () => {
    initTextareaAutosize();

    initSubmitLoader({
        formId: "contactForm",
        buttonId: "submitBtn",
        loadingText: "Enviando...",
    });

    initFormValidator("#contactForm", {
        validateOnBlur: true,
        validateOnInput: false,
        scrollToFirstError: true,
    });
});