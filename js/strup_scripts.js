const COLOR_HEX   = ['#C10000', '#0D2E7B', '#22C285', '#0FA8E2', '#FFC247', '#EC6A3A', '#700661']
const COLOR_NAMES = ['КРАСНЫЙ', 'СИНИЙ', 'ЗЕЛЁНЫЙ', 'ГОЛУБОЙ', 'ЖЁЛТЫЙ', 'ОРАНЖЕВЫЙ', 'ФИОЛЕТОВЫЙ']
const FREQUENCIES = [0, 10, 20, 30, 50]
const BREAK_WORD  = 'ХЛОПОК'
const WHAT_COLORED_SETTING__BCKGR = 2
const SWAP_INTERVAL = 5; // меняем задание после 5го изменения плашки со словом
const SWAP_OPTIONS = ['слово', 'цвет']
const DELAY  = 1500


let delays
let frequency_break_word

let strup_box
let strup_word
let strup_attention
let strup_close_btn
let colored_property
let bw_property
let word_color

let input_velocity_node

let exercise_interval_id
let swap_counter
let current_text_index

let navbar_node
let navbar_container
let navbar_btn

let error_text_node


function ready_strup() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))

    delays = make_delays_array(300, 300, 10)
    console.log(delays)

    strup_box        = document.getElementById('strup_box')
    strup_word       = document.getElementById('strup_word')
    strup_attention  = document.getElementById('strup_attention')
    strup_close_btn  = document.getElementById('close_exercise')

    input_velocity_node   = document.getElementById('input_velocity')

    navbar_node      = document.getElementById('navbar')
    navbar_container = document.getElementById('navbar_container')
    navbar_btn       = document.getElementById('navbar_button')

    error_text_node  = document.getElementById('switchers_error')

    set_event_listeners_to_change_velocity_buttons('btn-change-velocity', input_velocity_node)
    set_event_listener_escape_fullscreen_mode(strup_box, stop_strup)
}


// TODO: унести в utils
// function set_event_listeners_to_change_velocity_buttons(){
//     const btns = document.getElementsByName('btn-change-velocity')
//     for (let j = 0; j < btns.length ; j++) {
//         btns[j].addEventListener('click', function(){
//             let dv = +this.getAttribute('data-change')
//             let velocity_value = Number(input_velocity.value)
//             if ((velocity_value > 1 && dv < 0) ||
//                 (velocity_value < 10 && dv > 0)
//             ){
//                 input_velocity.value = dv + velocity_value
//             }
//         })
//     }
// }


// TODO: унести в utils (там уже есть похожая)
function resize_playground_strup(make_bigger) {
    if(make_bigger) {
        strup_word.style.display      = 'block'
        strup_word.style.visibility   = 'hidden'
        if(word_color){
            strup_attention.style.display = 'block'
        }
        strup_close_btn.style.display = 'block'

        let ww = document.documentElement.clientWidth
        let hh = document.documentElement.clientHeight
        let menu_btn_width = Number(navbar_btn.offsetWidth)

        let pl = get_property_int_value(navbar_container, 'padding-left')
        let pt = get_property_int_value(navbar_node, 'padding-top')

        let left   = menu_btn_width + 2*pl
        let top    = pt
        let width  = ww - menu_btn_width - 3*pl
        let height = hh - 2*pt

        set_pos_dom_element(strup_box, 'absolute', left, top)
        strup_box.style.setProperty('width', width + 'px')
        strup_box.style.setProperty('height', height + 'px')
    }
    else {
        strup_word.style.display      = 'none'
        strup_word.style.visibility   = 'visible'
        if(word_color){
            strup_attention.style.display = 'none'
        }
        strup_close_btn.style.display = 'none'

        strup_box.style.removeProperty('left')
        strup_box.style.removeProperty('top')
        strup_box.style.setProperty('width', 'var(--box-for-strup-size)')
        strup_box.style.setProperty('height', 'var(--box-for-strup-size)')
    }
}

//TODO: применить к коду
function show_hide_exercise_symbols(/*bool*/show){
    symbols_node.style.visibility = show ? 'visible' : 'hidden'
    symbols_node.style.display    = show ? 'block' : 'none'
    exercise_close_btn.style.display     = show ? 'block' : 'none'
}


function stop_strup(){
    clearInterval(exercise_interval_id)
    resize_playground_strup(false)
    show_hide_lorem_colors(true)
    console.log('stop_strup')
}


function show_new_word() {
    swap_counter++
    strup_word.style.visibility = 'hidden'
    strup_word.innerHTML = (get_random_int(0, 100) > frequency_break_word)
        ? COLOR_NAMES[get_random_int(0, COLOR_NAMES.length - 1)]
        : BREAK_WORD

    const left = get_random_int(0, strup_box.offsetWidth - strup_word.offsetWidth)
    const top  = get_random_int(0, strup_box.offsetHeight - strup_word.offsetHeight)
    set_pos_dom_element(strup_word, '', left, top)

    const color = COLOR_HEX[get_random_int(0, COLOR_HEX.length - 1 )]
    strup_word.style.setProperty(colored_property, color)
    make_yellow_contrast(strup_word, color)
    make_text_white(flying_symbols_node, color)
    strup_word.style.visibility = 'visible'

    if (word_color && (swap_counter === SWAP_INTERVAL + 1)){
        swap_attention()
        swap_counter = 0
    }
}


function start_strup() {
    console.log('start_strup')

    const DELAY__SELECTED = Number(input_velocity_node.value)
    if (check_velocity_input(DELAY__SELECTED)) {
        const WHAT_COLORED__SELECTED = document.querySelector('input[type="radio"][name="btnradio-what-colored"]:checked').getAttribute('data-what-colored')
        const FREQUENCY__SELECTED = document.querySelector('input[type="radio"][name="btnradio-frequency"]:checked').getAttribute('data-frequency')
        const WORD_COLOR__SELECTED = document.querySelector('input[type="radio"][name="btnradio-word-color"]:checked').getAttribute('data-word-color')

        frequency_break_word = FREQUENCIES[+FREQUENCY__SELECTED]
        words_delay          = delays[DELAY__SELECTED - 1]
        colored_property     = WHAT_COLORED__SELECTED == WHAT_COLORED_SETTING__BCKGR ? 'color' : 'background-color'
        bw_property          = WHAT_COLORED__SELECTED == WHAT_COLORED_SETTING__BCKGR ? 'background-color' : 'color'
        word_color           = WORD_COLOR__SELECTED == 1 ? true : false

        error_text_node.style.visibility = 'hidden'
        show_hide_lorem_colors(false)
        resize_playground_strup(true)
        strup_word.style.setProperty(bw_property, 'white')

        swap_counter = 0
        current_text_index = 0
        show_new_word()
        exercise_interval_id = setInterval(show_new_word, words_delay)
    }
    else {
        error_text_node.innerHTML = 'Задайте скорость появления слов от 1 до 10'
        error_text_node.style.setProperty('visibility', 'visible')
    }
}


function swap_attention(){
    strup_attention.innerHTML = SWAP_OPTIONS[current_text_index]
    current_text_index = (current_text_index + 1) % SWAP_OPTIONS.length

    const currest_style = window.getComputedStyle(strup_attention)
    const color1 = currest_style.getPropertyValue('background-color')
    const color2 = currest_style.getPropertyValue('color')

    strup_attention.style.backgroundColor = color2
    strup_attention.style.color = color1
}