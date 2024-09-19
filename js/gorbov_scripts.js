const TABLE_ORDER_DIRECT  = 1
const TABLE_ORDER_REVERSE = 2

const TABLE_COLOR_SETTING_CELLS = 1
const TABLE_HINT_SHOW = 1

const TABLE_SIZE = 6

const GORBOV_COLOR_RED = '#c10000'
const GORBOV_COLOR_BLACK = '#1c1c1c'

const NUMBER_ELEMENTS_ALL   = TABLE_SIZE * TABLE_SIZE
const NUMBER_ELEMENTS_RED   = Math.ceil(NUMBER_ELEMENTS_ALL / 2)
const NUMBER_ELEMENTS_BLACK = NUMBER_ELEMENTS_ALL - NUMBER_ELEMENTS_RED

let exercise_timer_id
let timer_node

let btn_start
let btn_again
let btn_stop
let btn_show_settings

let all_switchers_container
let results_container

let error_text_node

let find_number_title_node
let find_number_node

let grid_table

let root_doc

// TODO: show_settings — возвращать цвет звёздочек
// TODO: в каком порядке выбирать числа — сначала все красные, сначала все чёрные, по очереди красный/чёрный

function ready_gorbov() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))
    
    timer_node = document.getElementById('exercise_timer')

    btn_start = document.getElementById('start_button')
    btn_again = document.getElementById('again_button')
    btn_stop  = document.getElementById('stop_button')
    btn_show_settings = document.getElementById('show_settings')

    all_switchers_container = document.getElementsByClassName('all-switchers-container')
    results_container = document.getElementsByClassName('results-container')

    error_text_node = document.getElementById('switchers_error')

    find_number_title_node = document.getElementById('find_number_title')
    find_number_title_node.innerHTML = 'Найдите число '
    find_number_node = document.getElementById('find_number')

    grid_table = document.querySelector('.grid')
    grid_table.style.setProperty('grid-template-columns', 'repeat(' + TABLE_SIZE + ', var(--cell-size))')

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
    for (let i = 0; i < NUMBER_ELEMENTS_ALL; i++) {
        cell = document.querySelector('.cell[data-number="' + (i+1) + '"]')
        cell.style.setProperty('background-color', 'var(--cell-background-color)')
        cell.style.removeProperty('color')
    }
}

function show_settings_g() {
    stop_gorbov()
    btn_again.style.setProperty('display', 'none');
    btn_show_settings.style.setProperty('display', 'none');
}


function start_gorbov() {
    const TABLE_ORDER_SELECTED = document.querySelector('input[type="radio"][name="btnradio-char-order"]:checked').getAttribute('data-order')
    const TABLE_COLOR_SETTING_SELECTED = document.querySelector('input[type="radio"][name="btnradio-color-setting"]:checked').getAttribute('data-color-setting')
    const TABLE_HINT_SELECTED = document.querySelector('input[type="radio"][name="btnradio-hint"]:checked').getAttribute('data-hint')

    let timer_seconds = 0
    let number_errors = 0

    let current_char_pos = 0

    init_state(TABLE_HINT_SELECTED)

    const cells_data_red   = generate_gorbov_array(NUMBER_ELEMENTS_RED, GORBOV_COLOR_RED)
    const cells_data_black = generate_gorbov_array(NUMBER_ELEMENTS_BLACK, GORBOV_COLOR_BLACK)
    let cells_data_all     = concat_gorbov_red_and_black_arrays(cells_data_red, cells_data_black)

    switch (+TABLE_ORDER_SELECTED) {
        case TABLE_ORDER_DIRECT:
            straight_data = cells_data_all.slice();
            break;
        case TABLE_ORDER_REVERSE:
            straight_data = cells_data_all.slice().reverse();
            break;
    }

    const CELL_PROPERTY_TO_CHANGE_COLOR = (TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) ? 'background-color' : 'color'
    console.log(CELL_PROPERTY_TO_CHANGE_COLOR)
    find_number_node.innerHTML = straight_data[0]['digit']
    find_number_node.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, straight_data[0]['color'])
    if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
        find_number_node.style.setProperty('color', 'var(--cell-font-color-gorbov)')
    }
    
    kanzas_city_shuffle(cells_data_all)
    set_data_to_cells(cells_data_all)
    
    // console.log('kanzas_city_shuffle cells_data =', cells_data)

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
            cell.style.removeProperty('padding-top');
            
            cell.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, data[i]['color'])
            if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
                cell.style.setProperty('color', 'var(--cell-font-color-gorbov)')
            }

            cell.addEventListener('click', check_click);
        }
        root_doc.style.setProperty('--cell-blur', 'blur(0px)');
        root_doc.style.setProperty('--cell-cursor', 'pointer');
    }

    function check_click(event) {
        let cell = event.target || event.srcElement
        let cell_color
        cell_color = get_hex_color(cell, CELL_PROPERTY_TO_CHANGE_COLOR)
        
        console.log(cell_color)

        if (cell.innerHTML == '' + straight_data[current_char_pos]['digit'] &&
            cell_color == straight_data[current_char_pos]['color'] &&
            current_char_pos == NUMBER_ELEMENTS_ALL - 1
        ) {
            clearInterval(exercise_timer_id);
            blink_gorbov(cell)
    
            btn_stop.style.setProperty('display', 'none')
            btn_again.style.setProperty('display', 'block')
            btn_show_settings.style.setProperty('display', 'block')
    
            find_number_title_node.style.setProperty('visibility', 'visible')
            find_number_node.style.setProperty('visibility', 'visible')
    
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
            find_number_node.innerHTML = straight_data[++current_char_pos]['digit']
            find_number_node.style.setProperty(CELL_PROPERTY_TO_CHANGE_COLOR, straight_data[current_char_pos]['color'])
            
            blink_gorbov(cell);
    
            console.log('Верно → ' + cell.innerHTML);
        } else {
            number_errors++
    
            console.log('Не верно, нажато → ' + cell.innerHTML);
            console.log('Количество ошибок = ' + number_errors);
        }
    }

    function blink_gorbov(cell) {
        cell.style.setProperty('background-color','var(--cell-blink-color)')
        setTimeout(function() {
            if(TABLE_COLOR_SETTING_SELECTED == TABLE_COLOR_SETTING_CELLS) {
                let color = straight_data[current_char_pos - 1]['color']
                cell.style.setProperty('background-color', color)
            }
            else {
                cell.style.setProperty('background-color','var(--cell-background-color)')
            }
        }, 80)
    }
}