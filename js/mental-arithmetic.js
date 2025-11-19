const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const SYMBOLS = [
    ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
    ['слово 1', 'слово 2', 'слово 3', 'слово 4', 'слово 5', 'слово 6']
]
const HANDS = 'ПОЛ'
const SIGN = '+−×'
const COLOR_HEX   = ['#C10000', '#0D2E7B', '#22C285', '#0FA8E2', '#FFC247', '#EC6A3A', '#700661']
const FREQUENCIES = [0, 10, 20, 30, 50]

const REGEX_NUMBER = new RegExp("^(?:[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|1000)$")


let delays = null

let exercise_box = null
let flying_symbols_node = null
let equation_node = null
let hand_node = null
let exercise_close_btn = null

let sign__selected       = null
let num_type__selected   = null
let show_hands__selected = null
let minimum__value       = null
let maximum__value       = null
let max_result__value    = null

let input_velocity_node = null
let input_minimal_node  = null
let input_maximum_node  = null
let input_max_result_node = null

let exercise_interval_id = null

let error_text = ''
let error_min_max = ''
let error_text_node = null

function ready_mental_arithmetic() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    popoverTriggerList.forEach(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))

    exercise_box        = document.getElementById('exercise_box')
    flying_symbols_node = document.getElementById('flying_block_with_symbols')
    equation_node       = document.getElementById('equation')
    hand_node           = document.getElementById('hand')
    exercise_close_btn  = document.getElementById('close_exercise')

    input_velocity_node   = document.getElementById('input_velocity')
    input_minimal_node    = document.getElementById('minimal_value')
    input_maximum_node    = document.getElementById('maximum_value')
    input_max_result_node = document.getElementById('maximum_result')

    error_text_node     = document.getElementById('switchers_error')

    delays = make_delays_array(300, 300, 10)
    console.log(delays)
    set_event_listeners_to_change_velocity_buttons('btn-change-velocity', input_velocity_node)
    set_event_listener_escape_fullscreen_mode(exercise_box, stop_mental_arithmetic)

    input_minimal_node.addEventListener('blur', validate_)
    input_maximum_node.addEventListener('blur', validate_)
}


function start_mental_arithmetic() {
    console.log('start_mental_arithmetic')

    const DELAY__SELECTED = Number(input_velocity_node.value)
    sign__selected = document.querySelector('input[type="radio"][name="btnradio-sign"]:checked').getAttribute('data-sign')
    num_type__selected = Number(document.querySelector('input[type="radio"][name="btnradio-num-types"]:checked').getAttribute('data-num-types'))
    show_hands__selected = Number(document.querySelector('input[type="radio"][name="btnradio-hands"]:checked').getAttribute('data-hands'))

    minimum__value    = Number(input_minimal_node.value)
    maximum__value    = Number(input_maximum_node.value)
    max_result__value = input_max_result_node.value

    error_text = validate_inputs(DELAY__SELECTED)

    if(error_text){
        error_text_node.innerHTML = error_text
        error_text_node.style.visibility = 'visible'
    }
    else {
        symbols_delay = delays[DELAY__SELECTED - 1]
        error_text_node.style.visibility = 'hidden'

        exercise_box.classList.remove('mental')
        show_exercise_symbols()
        resize_playground(true, exercise_box)

        show_new_equation()
        exercise_interval_id = setInterval(show_new_equation, symbols_delay)
    }
}


function show_new_equation(){
    flying_symbols_node.style.visibility = 'hidden'

    const numbers   = generate_numbers()
    const coords    = get_new_coords_for_equation_block()

    equation_node.innerText = make_equation(numbers)
    if (show_hands__selected){
        const hand_index    = get_random_int(0, HANDS.length - 1)
        hand_node.innerText = HANDS[hand_index]
    }

    set_pos_dom_element(flying_symbols_node, '', coords[0], coords[1])

    let color = COLOR_HEX[get_random_int(0, COLOR_HEX.length - 1 )]
    flying_symbols_node.style.backgroundColor = color//COLOR_HEX[1]
    make_yellow_contrast(flying_symbols_node, color)
    make_text_white(flying_symbols_node, color)

    flying_symbols_node.style.visibility = 'visible'
}

function generate_numbers() {
    const divider = [1, 10, 100][num_type__selected] || 1
    const generator = divider === 1 ? get_random_int : getRandomMultiple

    return [
        generator(Number(minimum__value), Number(maximum__value), divider),
        generator(Number(minimum__value), Number(maximum__value), divider)
    ]
}

function getRandomMultiple(min, max, divider = 10) {
    if (min > max || divider <= 0) {
        throw new Error('Неверные значения min || max || divider')
    }
    const start = Math.ceil(min / divider) * divider
    const end   = Math.floor(max / divider) * divider

    if (start > end) throw new Error('Некорректный диапазон')

    return (Math.floor(Math.random() * ((end - start) / divider + 1)) * divider + start)
}

function make_equation(numbers) {
    const sign = sign__selected === '0'
        ? SIGN[get_random_int(0, 2)]
        : sign__selected;

    if (sign === '−' && numbers[0] < numbers[1]) {
        [numbers[0], numbers[1]] = [numbers[1], numbers[0]]
    }
    return `${numbers[0]} ${sign} ${numbers[1]}`
}

function get_new_coords_for_equation_block(){
    let left = get_random_int(0, exercise_box.offsetWidth - flying_symbols_node.offsetWidth)
    let top  = get_random_int(0, exercise_box.offsetHeight - flying_symbols_node.offsetHeight)
    return [left, top]
}

function stop_mental_arithmetic() {
    console.log('stop_mental_arithmetic')
    clearInterval(exercise_interval_id)
    resize_playground(false, exercise_box)
    hide_exercise_symbols()
    exercise_box.classList.add('mental')
}

function show_exercise_symbols(){
    flying_symbols_node.style.display    = 'block'
    flying_symbols_node.style.visibility = 'visible'
    exercise_close_btn.style.display     = 'block'

    if (show_hands__selected){
        hand_node.style.display = 'flex'
        equation_node.classList.remove('pb-4')
        equation_node.classList.add('pb-2')
    }
    else{
        hand_node.style.setProperty('display', 'none', 'important')
        equation_node.classList.remove('pb-2')
        equation_node.classList.add('pb-4')

    }
}

function hide_exercise_symbols(){
    flying_symbols_node.style.visibility = 'hidden'
    flying_symbols_node.style.display    = 'none'
    exercise_close_btn.style.display     = 'none'
}

function validate_inputs(velocity){
    let error_text = ''
    const inputs = [
        { value: minimum__value, message: 'Минимум — введите число от 1 до 1000' },
        { value: maximum__value, message: 'Максимум — введите число от 1 до 1000' },
        { value: max_result__value, message: 'Введите число от 1 до 1000' }
    ]

    if (!check_velocity_input(velocity)){
        error_text += 'Задайте скорость символов от 1 до 10<br>'
    }

    for (const { value, message } of inputs) {
        if (!REGEX_NUMBER.test(value)) {
            error_text += message + '<br>'
        }
    }
    error_text += error_min_max
    return error_text
}

function validate_(){
    if (Number(input_minimal_node.value) >= Number(input_maximum_node.value)){
        input_minimal_node.setCustomValidity('ошибка')
        input_maximum_node.setCustomValidity('ошибка')
        error_min_max = 'Минимальное значение должно быть меньше максимального<br>'
    }
    else {
        input_minimal_node.setCustomValidity('')
        input_maximum_node.setCustomValidity('')
        error_min_max = ''
    }
}