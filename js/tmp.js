// Инициализируем счетчик и интервал
let swapCounter = 0;
const SWAP_INTERVAL = 5; // меняем каждые 5 вызовов
let isSwapEnabled = true; // флаг включения/выключения

function show_new_word() {
    strup_word.style.visibility = 'hidden';
    strup_word.innerHTML = (get_random_int(0, 100) > frequency_break_word)
        ? COLOR_NAMES[get_random_int(0, COLOR_NAMES.length - 1)]
        : BREAK_WORD;

    // Позиционирование
    let left = get_random_int(0, strup_box.offsetWidth - strup_word.offsetWidth);
    let top = get_random_int(0, strup_box.offsetHeight - strup_word.offsetHeight);
    set_pos_dom_element(strup_word, '', left, top);

    // Установка цвета
    let color = COLOR_HEX[get_random_int(0, COLOR_HEX.length - 1)];
    strup_word.style.setProperty(colored_property, color);
    make_yellow_contrast(strup_word, color);
    strup_word.style.visibility = 'visible';

    // Условие для swap_attention
    if (word_color && isSwapEnabled) {
        swapCounter++;
        if (swapCounter % SWAP_INTERVAL === 0) {
            swap_attention();
        }
    }
}

// Запускаем интервал
const interval = setInterval(() => {
    show_new_word();
}, 1000); // например, каждые 1000 мс (1 секунда)

// Функция для остановки интервала
function stopInterval() {
    clearInterval(interval);
}

// Функция для сброса счетчика
function resetSwapCounter() {
    swapCounter = 0;
}