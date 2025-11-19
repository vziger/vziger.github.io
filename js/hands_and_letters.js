const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const SYMBOLS = [
    ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
    ['слово 1', 'слово 2', 'слово 3', 'слово 4', 'слово 5', 'слово 6']
]
const HANDS = 'ПОЛ'
const COLOR_HEX   = ['#C10000', '#0D2E7B', '#22C285', '#0FA8E2', '#FFC247', '#EC6A3A', '#700661']
const FREQUENCIES = [0, 10, 20, 30, 50]

let delays = null
let frequency_break_word = null

let exercise_box = null
let symbols_node = null
let letter_node = null
let hand_node = null
let exercise_close_btn = null

let symbols__selected = null

let input_velocity_node = null
let exercise_interval_id = null

let error_text_node = null

function ready_hands_and_letters() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))

    exercise_box        = document.getElementById('exercise_box')
    flying_symbols_node = document.getElementById('flying_block_with_symbols')
    letter_node         = document.getElementById('letter')
    hand_node           = document.getElementById('hand')
    exercise_close_btn  = document.getElementById('close_exercise')

    input_velocity_node = document.getElementById('input_velocity')

    error_text_node     = document.getElementById('switchers_error')

    delays = make_delays_array(300, 300, 10)
    set_event_listeners_to_change_velocity_buttons('btn-change-velocity', input_velocity_node)
    set_event_listener_escape_fullscreen_mode(exercise_box, stop_hands_and_letters)
}


// TODO: унести в utils (и в Струпе)
function show_hide_exercise_symbols(/*bool*/show){
    flying_symbols_node.style.visibility = show ? 'visible' : 'hidden'
    flying_symbols_node.style.display    = show ? 'block' : 'none'
    exercise_close_btn.style.display     = show ? 'block' : 'none'
}


function show_new_symbols() {
    flying_symbols_node.style.visibility = 'hidden'

    let length = SYMBOLS[symbols__selected].length
    letter_node.innerText = SYMBOLS[symbols__selected][get_random_int(0, length - 1)]
    hand_node.innerText = HANDS[get_random_int(0, HANDS.length - 1)]

    let left = get_random_int(0, exercise_box.offsetWidth - flying_symbols_node.offsetWidth)
    let top  = get_random_int(0, exercise_box.offsetHeight - flying_symbols_node.offsetHeight)

    set_pos_dom_element(flying_symbols_node, '', left, top)

    let color = COLOR_HEX[get_random_int(0, COLOR_HEX.length - 1 )]
    flying_symbols_node.style.backgroundColor = color
    make_yellow_contrast(flying_symbols_node, color)
    make_text_white(flying_symbols_node, color)

    flying_symbols_node.style.visibility = 'visible'

}

function start_hands_and_letters(){
    console.log('start_hands_and_letters')
    const DELAY__SELECTED = Number(input_velocity_node.value)
    symbols__selected = Number(document.querySelector('input[type="radio"][name="btnradio-symbols"]:checked').getAttribute('data-symbols'))

    if (check_velocity_input(DELAY__SELECTED)) {
        words_delay = delays[DELAY__SELECTED - 1]

        error_text_node.style.setProperty('visibility', 'hidden')

        // show_hide_lorem_colors(false)
        exercise_box.classList.remove('alhabet')
        show_hide_exercise_symbols(true)
        resize_playground(true, exercise_box)

        show_new_symbols()
        exercise_interval_id = setInterval(show_new_symbols, words_delay)
    }
    else {
        error_text_node.innerHTML = 'Задайте скорость символов от 1 до 10'
        error_text_node.style.setProperty('visibility', 'visible')
    }
}

function stop_hands_and_letters(){
    console.log('stop_hands_and_letters')
    clearInterval(exercise_interval_id)
    resize_playground(false, exercise_box)
    show_hide_exercise_symbols(false)
    exercise_box.classList.add('alhabet')
    // show_hide_lorem_colors(true)
}