(function () {
    "use strict";

    var loader = document.querySelector(".loader-wrapper");
    if (!loader) return;

    var startedAt = performance.now();
    var dismissed = false;
    var minimumVisibleTime = 180;
    var fallbackTimer = window.setTimeout(dismiss, 850);
    var hardStopTimer = window.setTimeout(removeLoader, 1500);

    function removeLoader() {
        if (!loader.isConnected) return;
        dismissed = true;
        window.clearTimeout(fallbackTimer);
        window.clearTimeout(hardStopTimer);
        loader.remove();
        document.dispatchEvent(new CustomEvent("site:loader-hidden"));
    }

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        window.clearTimeout(fallbackTimer);

        var remainingTime = Math.max(0, minimumVisibleTime - (performance.now() - startedAt));
        window.setTimeout(function () {
            if (!loader.isConnected) return;
            loader.classList.add("is-leaving");
            loader.addEventListener("transitionend", removeLoader, { once: true });
            window.setTimeout(removeLoader, 650);
        }, remainingTime);
    }

    if (document.readyState !== "loading") {
        dismiss();
    } else {
        document.addEventListener("DOMContentLoaded", dismiss, { once: true });
    }
}());
