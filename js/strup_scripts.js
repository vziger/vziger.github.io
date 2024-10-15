const COLOR_HEX   = ['#C10000', '#0D2E7B', '#22C285', '#51BAE2', '#ffcd4d', '#EC6A3A', '#700661']
const COLOR_NAMES = ['КРАСНЫЙ', 'СИНИЙ', 'ЗЕЛЁНЫЙ', 'ГОЛУБОЙ', 'ЖЁЛТЫЙ', 'ОРАНЖЕВЫЙ', 'ФИОЛЕТОВЫЙ']
const FREQUENCIES = [0, 10, 20, 30, 50]
const BREAK_WORD  = 'ХЛОПОК'
const WHAT_COLORED_SETTING__BCKGR = 2
const DELAY  = 1500

let delays
let frequency_break_word

let box_margin = 48
let box_size
let strup_box
let strup_playground
let colored_property
let bw_property
let strup_close_btn

let input_velocity
let velocity = 1
let root_doc

let exercise_interval_id

let navbar_node
let navbar_container

let btn_navbar
let error_text_node


function ready_strup() {
    root_doc = document.documentElement

    delays = make_delays_array(300, 300, 10)
    console.log(delays)

    strup_box        = document.getElementById('strup_box')
    strup_playground = document.getElementById('strup_playground')
    strup_close_btn  = document.getElementById('close_exercise')

    // TODO: get_property_int_value()
    box_size = getComputedStyle(root_doc, null).getPropertyValue('--box-for-strup-size')
    box_size = +box_size.substring(0, box_size.length - 2)

    input_velocity = document.getElementById('input_velocity')
    
    navbar_node = document.getElementById('navbar')
    navbar_container = document.getElementById('navbar_container')

    btn_navbar = document.getElementById('navbar_button')
    error_text_node = document.getElementById('switchers_error')

    set_event_listeners_to_change_velocity_buttons()
    set_event_listener_escape_fullscreen_mode(strup_box, stop_strup)
}


// TODO: унести в utils
function set_event_listeners_to_change_velocity_buttons(){
    const btns = document.getElementsByName('btn-change-velocity')
    for (let j = 0; j < btns.length ; j++) {
        btns[j].addEventListener('click', function(){
            let dv = +this.getAttribute('data-change')
            let velocity_value = Number(input_velocity.value)
            if ((velocity_value > 1 && dv < 0) || 
                (velocity_value < 10 && dv > 0)
            ){
                input_velocity.value = dv + velocity_value
                velocity = +input_velocity.value
            }
        })
    }
}


function show_hide_lorem_colors(show) {
    let property_value = show == true ? 'block' : 'none'
    lorem_colors = document.getElementsByName("text-color")
    for (let i = lorem_colors.length - 1; i >= 0 ; --i) {
        lorem_colors[i].style.setProperty('display', property_value)
    }
}


function resize_playground(make_bigger) {
    if(make_bigger) {
        strup_playground.style.setProperty('display', 'block')
        strup_playground.style.setProperty('visibility', 'hidden')
        strup_close_btn.style.setProperty('display', 'block')
        
        let ww = document.documentElement.clientWidth
        let hh = document.documentElement.clientHeight
        let menu_btn_width = Number(btn_navbar.offsetWidth)

        let pl = get_property_int_value(navbar_container, 'padding-left')
        let pt = get_property_int_value(navbar_node, 'padding-top')

        let left = menu_btn_width + 2*pl
        let top  = pt
        let width = ww - menu_btn_width - 3*pl
        let height = hh - 2*pt

        set_pos_dom_element(strup_box, 'absolute', left, top)
        strup_box.style.setProperty('width', width + 'px')
        strup_box.style.setProperty('height', height + 'px')   
    }
    else {
        strup_playground.style.setProperty('display', 'none')
        strup_playground.style.setProperty('visibility', 'visible')
        strup_close_btn.style.setProperty('display', 'none')

        strup_box.style.removeProperty('left')
        strup_box.style.removeProperty('top')
        strup_box.style.setProperty('width', 'var(--box-for-strup-size)')
        strup_box.style.setProperty('height', 'var(--box-for-strup-size)')
    }
}


function stop_strup(){
    clearInterval(exercise_interval_id)
    resize_playground(false)
    show_hide_lorem_colors(true)
    console.log('stop_strup')
}


function get_word() {
    strup_playground.style.visibility = 'hidden'
    strup_playground.innerHTML = get_random_int(0, 100) > frequency_break_word ? COLOR_NAMES[get_random_int(0, COLOR_NAMES.length - 1)] : BREAK_WORD
    
    let left = get_random_int(0, strup_box.offsetWidth - strup_playground.offsetWidth)
    let top  = get_random_int(0, strup_box.offsetHeight - strup_playground.offsetHeight)

    set_pos_dom_element(strup_playground, '', left, top)
    
    let color = COLOR_HEX[get_random_int(0, COLOR_HEX.length - 1 )]
    strup_playground.style.setProperty(colored_property, color)
    if (color == '#ffcd4d') {
        strup_playground.style.setProperty('text-shadow', '.5px .5px #C58D00')
    }
    else {
        strup_playground.style.removeProperty('text-shadow')
    }
    strup_playground.style.visibility = 'visible';
}


function start_strup() {
    console.log('start_strup')

    if (check_velocity_input(input_velocity.value)) {
        const WHAT_COLORED__SELECTED = document.querySelector('input[type="radio"][name="btnradio-what-colored"]:checked').getAttribute('data-what-colored')
        const DELAY__SELECTED = Number(input_velocity.value)
        const FREQUENCY__SELECTED = document.querySelector('input[type="radio"][name="btnradio-frequency"]:checked').getAttribute('data-frequency')

        frequency_break_word = FREQUENCIES[+FREQUENCY__SELECTED]
        words_delay          = delays[DELAY__SELECTED - 1]
        colored_property     = WHAT_COLORED__SELECTED == WHAT_COLORED_SETTING__BCKGR ? 'color' : 'background-color'
        bw_property          = WHAT_COLORED__SELECTED == WHAT_COLORED_SETTING__BCKGR ? 'background-color' : 'color'

        error_text_node.style.setProperty('visibility', 'hidden')
        show_hide_lorem_colors(false)
        resize_playground(true)
        strup_playground.style.setProperty(bw_property, 'white')

        get_word()
        exercise_interval_id = setInterval(get_word, words_delay)
    }
    else {
        error_text_node.innerHTML = 'Задайте скорость появления слов от 1 до 10'
        error_text_node.style.setProperty('visibility', 'visible')
    }
    
}