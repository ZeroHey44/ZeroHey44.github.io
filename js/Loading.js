document.addEventListener('DOMContentLoaded', function () {
    // 使用 setTimeout 在延迟 0.5 秒后隐藏并销毁 loader-wrapper
    setTimeout(function () {
        var loaderWrapper = document.querySelector('.loader-wrapper');
        loaderWrapper.style.opacity = '0';

        // 在过渡完成后隐藏并销毁元素
        setTimeout(function () {
            loaderWrapper.style.display = 'none';
            loaderWrapper.remove(); // 销毁元素
        }, 500);
    }, 500);
});