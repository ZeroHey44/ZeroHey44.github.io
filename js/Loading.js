(function () {
    "use strict";

    var loader = document.querySelector(".loader-wrapper");
    if (!loader) return;

    var startedAt = performance.now();
    var dismissed = false;
    var minimumVisibleTime = 260;
    var fallbackTimer = window.setTimeout(dismiss, 7000);

    function removeLoader() {
        if (!loader.isConnected) return;
        loader.remove();
        document.dispatchEvent(new CustomEvent("site:loader-hidden"));
    }

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        window.clearTimeout(fallbackTimer);

        var remainingTime = Math.max(0, minimumVisibleTime - (performance.now() - startedAt));
        window.setTimeout(function () {
            loader.classList.add("is-leaving");
            loader.addEventListener("transitionend", removeLoader, { once: true });
            window.setTimeout(removeLoader, 900);
        }, remainingTime);
    }

    if (document.readyState === "complete") {
        dismiss();
    } else {
        window.addEventListener("load", dismiss, { once: true });
    }
}());
