const ELEMENTS_ALPHABET_RU = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const regex = new RegExp("^[а-яА-ЯЁё]$")

const TABLE_TYPE_DIGITS  = 1
const TABLE_TYPE_LETTERS = 2

const TABLE_ORDER_DIRECT  = 1
const TABLE_ORDER_REVERSE = 2

const TABLE_HINT_SHOW = 1

let exercise_timer_id
let timer_node

let entered_first_symbol = 'А'

let btn_start
let btn_again
let btn_stop
let btn_show_settings

let all_switchers_container
let results_container
let start_symbol_node
let start_symbol_help_inline_node
let error_text_node

let find_number_title_node
let find_number_node

let root_doc


function ready() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))
    
    timer_node = document.getElementById('exercise_timer')

    btn_start = document.getElementById('start_button')
    btn_again = document.getElementById('again_button')
    btn_stop  = document.getElementById('stop_button')
    btn_show_settings = document.getElementById('show_settings')

    all_switchers_container = document.getElementsByClassName('all-switchers-container')
    results_container = document.getElementsByClassName('results-container')

    start_symbol_node = document.getElementById('start_symbol')
    start_symbol_help_inline_node = document.getElementById('help_inline')

    find_number_title_node = document.getElementById('find_number_title')
    find_number_node = document.getElementById('find_number')

    error_text_node = document.getElementById('switchers_error')

    root_doc = document.documentElement;
}


function delete_elements(list_of_elements) {
    for (let i = list_of_elements.length - 1; i >=0 ; --i) {
        list_of_elements[i].remove()
    }
}


function create_new_cells_for_table(number, grid_table) {
    let new_cell
    for (let i = 0; i < number*number; i++) {
        new_cell = document.createElement('div')
        new_cell.setAttribute('class', 'cell')
        new_cell.setAttribute('data-number', i+1)
        new_cell.innerHTML = '*'
        new_cell.style.setProperty('padding-top', 'var(--asterisk-shift-pdt)')
        grid_table.appendChild(new_cell)
    }
}


function draw_table(size){
    let grid_cells = document.getElementsByClassName('cell')
    let grid_table = document.querySelector('.grid')

    delete_elements(grid_cells)
    create_new_cells_for_table(size, grid_table)

    grid_table.style.setProperty('grid-template-columns', 'repeat(' + size + ', var(--cell-size))')
}


function make_disabled_start_symbol(flag) {
    start_symbol_node.disabled = flag
    if (flag) {
        entered_first_symbol = start_symbol_node.value
        start_symbol_node.value = '1'
        start_symbol_help_inline_node.style.setProperty('visibility', 'hidden')
        error_text_node.style.setProperty('visibility', 'hidden')
    }
    else {
        if (ELEMENTS_ALPHABET_RU.indexOf(entered_first_symbol) >=0) {
            start_symbol_node.value = entered_first_symbol
        }
        else{
            start_symbol_node.value = 'А'
        }
        start_symbol_help_inline_node.style.setProperty('visibility', 'visible')
    }
}


function generate_numbers_array(size) {
    let arr = new Array(size)
    for (let i = 0; i < size; i++) {
        arr[i] = i + 1
    }
    return arr
}


function kanzas_city_shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr
}


function display_hide_containers(list_elements, show_hide_flag) {
    for (let j = 0; j < list_elements.length ; j++) {
        list_elements[j].style.setProperty('display', show_hide_flag)
    }
}


function show_settings() {
    root_doc.style.setProperty('--cell-blur', 'blur(8px)');
    root_doc.style.setProperty('--cell-cursor', 'default');

    set_asterisks_into_cells();
    
    display_hide_containers(all_switchers_container, 'block');
    display_hide_containers(results_container, 'none');

    find_number_title_node.style.setProperty('visibility', 'hidden');
    find_number_node.style.setProperty('visibility', 'hidden');
    
    btn_show_settings.style.setProperty('display', 'none');
    btn_start.style.setProperty('display', 'block');
    btn_again.style.setProperty('display', 'none');
}


function blink(cell) {
    cell.style.setProperty('background-color','var(--cell-blink-color)')
        setTimeout(function() {
            cell.style.setProperty('background-color','var(--cell-background-color)');
        }, 50)
}


function set_asterisks_into_cells() {
    let grid_cells = document.getElementsByClassName('cell')
    for (let i = grid_cells.length - 1; i >=0 ; --i) {
        grid_cells[i].innerHTML = '*'
        grid_cells[i].style.setProperty('padding-top', 'var(--asterisk-shift-pdt)')
    }
}


function stop_schulte() {
    clearInterval(exercise_timer_id);

    root_doc.style.setProperty('--cell-blur', 'blur(8px)');
    root_doc.style.setProperty('--cell-cursor', 'default');

    set_asterisks_into_cells();
    
    display_hide_containers(all_switchers_container, 'block');
    display_hide_containers(results_container, 'none');
    
    find_number_title_node.style.setProperty('visibility', 'hidden');
    find_number_node.style.setProperty('visibility', 'hidden');

    btn_stop.style.setProperty('display', 'none');
    btn_start.style.setProperty('display', 'block');
}


function check_first_symbol() {
    entered_first_symbol = '' + start_symbol_node.value
    return (entered_first_symbol.length == 1 && regex.test(entered_first_symbol))
}


function init_state(table_hint_selected) {
    error_text_node.style.setProperty('visibility', 'hidden')

    timer_node.style.setProperty('visibility', 'visible')

    if (table_hint_selected == TABLE_HINT_SHOW) {
        find_number_title_node.style.setProperty('visibility', 'visible')
        find_number_node.style.setProperty('visibility', 'visible')
    }
    else {
        find_number_title_node.style.setProperty('visibility', 'hidden')
	    find_number_node.style.setProperty('visibility', 'hidden')
    }

    btn_start.style.setProperty('display', 'none')
    btn_again.style.setProperty('display', 'none')
    btn_stop.style.setProperty('display', 'block')
    btn_show_settings.style.setProperty('display', 'none')

    display_hide_containers(all_switchers_container, 'none')
    display_hide_containers(results_container, 'block')

    timer_node.innerHTML = '00:00'
}


function start_schulte(){
    const TABLE_TYPE_SELECTED  = document.querySelector('input[type="radio"][name="btnradio-type"]:checked').getAttribute('data-type')
    
    if (check_first_symbol() || +TABLE_TYPE_SELECTED == TABLE_TYPE_DIGITS) {
        const TABLE_SIZE_SELECTED  = document.querySelector('input[type="radio"][name="btnradio-size"]:checked').getAttribute('data-size')    
        const TABLE_HINT_SELECTED  = document.querySelector('input[type="radio"][name="btnradio-hint"]:checked').getAttribute('data-hint')
        const TABLE_ORDER_SELECTED = document.querySelector('input[type="radio"][name="btnradio-char-order"]:checked').getAttribute('data-order')

        const NUMBER_ELEMENTS = TABLE_SIZE_SELECTED * TABLE_SIZE_SELECTED
        let cells_data        = new Array(NUMBER_ELEMENTS)
        let straight_data     = new Array(NUMBER_ELEMENTS)
        let first_symbol      = start_symbol_node.value

        let timer_seconds = 0
        let number_errors = 0
        
        let current_char_pos = 0

        init_state(TABLE_HINT_SELECTED)
        exercise_timer_id = setInterval(timer, 1000)

        switch (+TABLE_TYPE_SELECTED) {
            case TABLE_TYPE_DIGITS:
                cells_data = generate_numbers_array(NUMBER_ELEMENTS)
                find_number_title_node.innerHTML = 'Найдите число '
                console.log(cells_data)
                console.log(current_char_pos)
                break
            case TABLE_TYPE_LETTERS:
                first_symbol_number = ELEMENTS_ALPHABET_RU.indexOf(first_symbol)
                cells_data = ELEMENTS_ALPHABET_RU.split('').slice(0 + first_symbol_number, NUMBER_ELEMENTS + first_symbol_number)
                find_number_title_node.innerHTML = 'Найдите букву '
                console.log(cells_data)
                console.log(current_char_pos)
                break
        }
        
        switch (+TABLE_ORDER_SELECTED) {
            case TABLE_ORDER_DIRECT:
                straight_data = cells_data.slice();
                break;
            case TABLE_ORDER_REVERSE:
                straight_data = cells_data.slice().reverse();
                break;
        }

        find_number_node.innerHTML = straight_data[0]

        kanzas_city_shuffle(cells_data);
        set_data_to_cells(cells_data, NUMBER_ELEMENTS)

        function timer() {
            timer_seconds++;
            timer_node.innerHTML = seconds_to_time(timer_seconds)
        }

        function set_data_to_cells(data, table_size) {
            for (let i = 0; i < table_size; i++) {
                let cell = document.querySelector('.cell[data-number="' + (i+1) + '"]')
                cell.innerHTML = data[i]
                cell.style.removeProperty('padding-top');
                
                cell.addEventListener('click', check_click);
            }
            root_doc.style.setProperty('--cell-blur', 'blur(0px)');
            root_doc.style.setProperty('--cell-cursor', 'pointer');
        }

        function check_click(event) {
            let cell = event.target || event.srcElement;
            if (cell.innerHTML == '' + straight_data[current_char_pos] && current_char_pos == NUMBER_ELEMENTS - 1) {
                clearInterval(exercise_timer_id);
                blink(cell)

                btn_stop.style.setProperty('display', 'none')
                btn_again.style.setProperty('display', 'block')
                btn_show_settings.style.setProperty('display', 'block')

                find_number_title_node.style.setProperty('visibility', 'visible')
                find_number_node.style.setProperty('visibility', 'visible')

                find_number_title_node.innerHTML = 'Всего ошибок: '
                find_number_node.innerHTML = number_errors

                current_char_pos++

                console.log('Верно → ' + cell.innerHTML)
            }
            if (cell.innerHTML == '' + straight_data[current_char_pos]) {
                find_number_node.innerHTML = straight_data[++current_char_pos]
                blink(cell);

                console.log('Верно → ' + cell.innerHTML);
            }
            else {
                number_errors++

                console.log('Не верно → ' + cell.innerHTML);
                console.log('Количество ошибок = ' + number_errors);
            }
        }
    }
    else {
        if (start_symbol_node.value == '') {
            error_text_node.innerHTML = 'Укажите первый символ'
            error_text_node.style.setProperty('visibility', 'visible')
        }
        else {
            error_text_node.innerHTML = 'Первый символ должен быть из кириллицы'
            error_text_node.style.setProperty('visibility', 'visible')
        }
    }
}
