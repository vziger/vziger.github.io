const TABLE_ORDER_DIRECT  = 1
const TABLE_ORDER_REVERSE = 2

const TABLE_COLOR_SETTING_CELLS = 1
const TABLE_HINT_SHOW = 1

const GORBOV_COLOR_RED = '#c10000'
const GORBOV_COLOR_BLACK = '#1c1c1c'

const REGEX_MULT = new RegExp("^([1-9]|10)$")

let table_size_global
let number_elements_all
let number_elements_red
let number_elements_black

let exercise_timer_id
let timer_node

let btn_start
let btn_again
let btn_stop
let btn_show_settings

let all_switchers_container
let results_container
let mult_red_node
let mult_black_node

let error_text_node

let find_number_title_node
let find_number_node

let grid_table

let root_doc


function ready_gorbov(table_size) {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))
    
    table_size_global = table_size
    number_elements_all   = table_size * table_size
    number_elements_red   = Math.ceil(number_elements_all / 2)
    number_elements_black = number_elements_all - number_elements_red

    timer_node = document.getElementById('exercise_timer')

    btn_start = document.getElementById('start_button')
    btn_again = document.getElementById('again_button')
    btn_stop  = document.getElementById('stop_button')
    btn_show_settings = document.getElementById('show_settings')

    all_switchers_container = document.getElementsByClassName('all-switchers-container')
    results_container = document.getElementsByClassName('results-container')
    mult_red_node     = document.getElementById('mult_red')
    mult_black_node   = document.getElementById('mult_black')
    console.log("mult_red_node =", mult_red_node)

    error_text_node = document.getElementById('switchers_error')

    find_number_title_node = document.getElementById('find_number_title')
    find_number_title_node.innerHTML = 'Найдите число '
    find_number_node = document.getElementById('find_number')

    grid_table = document.querySelector('.grid')
    grid_table.style.setProperty('grid-template-columns', 'repeat(' + table_size + ', var(--cell-size))')

    root_doc = document.documentElement;
}


function init_state(table_hint_selected) {
    error_text_node.style.setProperty('visibility', 'hidden')

    timer_node.style.setProperty('visibility', 'visible')

    if (table_hint_selected == TABLE_HINT_SHOW) {
        find_number_title_node.style.setProperty('visibility', 'visible')
        find_number_node.style.setProperty('visibility', 'visible')
        find_number_node.style.removeProperty('background-color')
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

    find_number_title_node.innerHTML = 'Найдите число '
    timer_node.innerHTML = '00:00'
}


function stop_gorbov() {
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

    let cell
    for (let i = 0; i < table_size_global * table_size_global; i++) {
        cell = document.querySelector('.cell[data-number="' + (i+1) + '"]')
        cell.style.setProperty('background-color', 'var(--cell-background-color)')
        cell.style.removeProperty('color')
    }
}

function show_settings_gorbov() {
    stop_gorbov();
    btn_again.style.setProperty('display', 'none');
    btn_show_settings.style.setProperty('display', 'none');
}

function can_start_gorbov() {
    let check_red = true
    let check_black = true
    if (mult_red_node) {
        check_red = REGEX_MULT.test(mult_red_node.value)
    }
    if (mult_black_node) {
        check_black = REGEX_MULT.test(mult_black_node.value)
    }
    return (check_red && check_black)
}

function start_gorbov() {
    if (can_start_gorbov()) {
        if (mult_red_node) {
            find_number_node.style.setProperty('width', '246px')
        }
        main_gorbov()
    }
    else {
        if(mult_red_node){
            if(!REGEX_MULT.test(mult_red_node.value) && !REGEX_MULT.test(mult_black_node.value)){
                error_text_node.innerHTML = 'Задайте оба множителя числом от 1 до 10'
            }
            else if(!REGEX_MULT.test(mult_red_node.value) && REGEX_MULT.test(mult_black_node.value)) {
                error_text_node.innerHTML = 'Задайте множитель для красного ряда от 1 до 10'
            }
            else if(REGEX_MULT.test(mult_red_node.value) && !REGEX_MULT.test(mult_black_node.value)) {
                error_text_node.innerHTML = 'Задайте множитель для чёрного ряда от 1 до 10'
            }
            error_text_node.style.setProperty('visibility', 'visible')
        }
    }
}

function main_gorbov() {
    const TABLE_ORDER_SELECTED_RED = document.querySelector('input[type="radio"][name="btnradio-char-order"]:checked').getAttribute('data-order')
    const TABLE_ORDER_SELECTED_BLACK = document.querySelector('input[type="radio"][name="btnradio-black-char-order"]:checked').getAttribute('data-order')
    const TABLE_COLOR_SETTING_SELECTED = document.querySelector('input[type="radio"][name="btnradio-color-setting"]:checked').getAttribute('data-color-setting')
    const TABLE_HINT_SELECTED = document.querySelector('input[type="radio"][name="btnradio-hint"]:checked').getAttribute('data-hint')


    // ****** ДЛЯ ГОРБОВА-УМНОЖЕНИЕ **************
    let mult_red
    let mult_black
    
    if (mult_red_node) {
        mult_red = +mult_red_node.value
        number_elements_red = 10
    }
    if (mult_black_node) {
        mult_black = +mult_black_node.value
        number_elements_black = 10
    }
    // ********************************************


    let timer_seconds = 0
    let number_errors = 0

    let current_char_pos = 0

    init_state(TABLE_HINT_SELECTED)

    let cells_data_red   = generate_gorbov_array(number_elements_red, GORBOV_COLOR_RED)
    let cells_data_black = generate_gorbov_array(number_elements_black, GORBOV_COLOR_BLACK)
    
    if (+TABLE_ORDER_SELECTED_RED == TABLE_ORDER_REVERSE) {
        cells_data_red = cells_data_red.reverse()
    }
    if (+TABLE_ORDER_SELECTED_BLACK == TABLE_ORDER_REVERSE) {
        cells_data_black = cells_data_black.reverse()
    }


    // ****** ДЛЯ ГОРБОВА-УМНОЖЕНИЕ **************
    if (mult_red_node) {
        number_elements_all = number_elements_red + number_elements_black
        cells_data_red   = multiply_array(cells_data_red, mult_red)
        cells_data_black = multiply_array(cells_data_black, mult_black)
    }
    // ********************************************


    let cells_data_all = concat_gorbov_red_and_black_arrays(cells_data_red, cells_data_black)
    let straight_data  = cells_data_all.slice()


    // ****** ДЛЯ ГОРБОВА-УМНОЖЕНИЕ **************
    if (mult_red_node) {
        let el = {digit: '*', color: 'var(--cell-background-color)'}
        cells_data_all.push(el, el, el, el, el)
    }
    // ********************************************


    const CELL_PROPERTY_TO_CHANGE_COLOR = (TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) ? 'background-color' : 'color'


    // ****** ДЛЯ ГОРБОВА-УМНОЖЕНИЕ **************
    if (mult_red_node) {
        find_number_node.innerHTML = '' + mult_red + ' × ' + straight_data[0]['digit']/mult_red + ' = '
    }
    else {
        find_number_node.innerHTML = straight_data[0]['digit']
    }

    find_number_node.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, straight_data[0]['color'])
    if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
        find_number_node.style.setProperty('color', 'var(--cell-font-color-gorbov)')
    }
    
    kanzas_city_shuffle(cells_data_all)
    set_data_to_cells(cells_data_all)
    
    exercise_timer_id = setInterval(timer, 1000)


    function timer() {
        timer_seconds++;
        timer_node.innerHTML = seconds_to_time(timer_seconds)
    }

    function set_data_to_cells(data) {
        let cell
        for (let i = 0; i < data.length; i++) {
            cell = document.querySelector('.cell[data-number="' + (i+1) + '"]')
            cell.innerHTML = data[i]['digit']
            cell.style.removeProperty('padding-top')
            
            cell.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, data[i]['color'])
            if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
                cell.style.setProperty('color', 'var(--cell-font-color-gorbov)')
            }

            cell.addEventListener('click', check_click);
        }
        root_doc.style.setProperty('--cell-blur', 'blur(0px)')
        root_doc.style.setProperty('--cell-cursor', 'pointer')
    }

    function check_click(event) {
        let cell = event.target || event.srcElement
        let cell_color
        cell_color = get_hex_color(cell, CELL_PROPERTY_TO_CHANGE_COLOR)
        
        console.log(cell_color)

        if (cell.innerHTML == '' + straight_data[current_char_pos]['digit'] &&
            cell_color == straight_data[current_char_pos]['color'] &&
            current_char_pos == number_elements_all - 1
        ) {
            clearInterval(exercise_timer_id)
            blink_cell_gorbov(cell)
    
            btn_stop.style.setProperty('display', 'none')
            btn_again.style.setProperty('display', 'block')
            btn_show_settings.style.setProperty('display', 'block')
    
            find_number_title_node.style.setProperty('visibility', 'visible')
            find_number_node.style.setProperty('visibility', 'visible')
            find_number_node.style.setProperty('width', '60px')
    
            find_number_title_node.innerHTML = 'Всего ошибок: '
            find_number_node.innerHTML = number_errors

            find_number_node.style.removeProperty('background-color')
            find_number_node.style.removeProperty('color')
    
            current_char_pos++
    
            console.log('Верно → ' + cell.innerHTML)
        }
        else if (cell.innerHTML == '' + straight_data[current_char_pos]['digit'] &&
            cell_color == straight_data[current_char_pos]['color']
        ) {
            
            // ****** ДЛЯ ГОРБОВА-УМНОЖЕНИЕ **************
            if (mult_red_node) {
                let mult = straight_data[++current_char_pos]['color'] == GORBOV_COLOR_RED ? mult_red : mult_black
                find_number_node.innerHTML = '' + mult + ' × ' + straight_data[current_char_pos]['digit']/mult + ' = '
            }
            else {
                find_number_node.innerHTML = straight_data[++current_char_pos]['digit']
            }

            find_number_node.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, straight_data[current_char_pos]['color'])
            
            blink_cell_gorbov(cell)
    
            console.log('Верно → ' + cell.innerHTML);
        } else {
            number_errors++
    
            console.log('Не верно, нажато → ' + cell.innerHTML);
            console.log('Количество ошибок = ' + number_errors);
        }
    }

    function blink_cell_gorbov(cell) {
        cell.style.setProperty('background-color','var(--cell-blink-color)')
        setTimeout(function() {
            if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
                let color = straight_data[current_char_pos - 1]['color']
                cell.style.setProperty('background-color', color)
            }
            else {
                cell.style.setProperty('background-color', 'var(--cell-background-color)')
            }
        }, 80)
    }
}