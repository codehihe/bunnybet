import React, { useEffect, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'

import PaymentForm from './paymentForm'
import PaymentCart from './paymentCart'

import { changePage, changeGame, changeGamePage } from '../../../reducers/page'

import countriesData from '../../../utils/constants/countries.json'
import { checkoutData, convertCurrency, isEmpty } from '../../../utils/utils'
import { validateCard } from '../../../utils/validate'
import { updatePaymentDetails } from '../../../reducers/paymentDetails'
import { changePopup } from '../../../reducers/popup'
import { translate } from '../../../translations/translate'

function Payment(props) {
    const { template, home, settings, exchange_rates } = props
    const { lang, currency } = settings
    const minimum_amount_inr = 850 // Approx 10 USD
    const maxAmount = 100
    const price_per_carrot = 85 // 1 carrot = 85 INR (approx 1 USD)
    const minimum_amount = convertCurrency(minimum_amount_inr, currency, exchange_rates, true, "INR")

    let dispatch = useDispatch()

    let payment_details = useSelector(state => state.paymentDetails)
    let cart = useSelector(state => state.cart.cart)
    let promo = useSelector(state => state.cart.promo)
    // let user = useSelector(state => state.auth.user) // Get user from auth slice

    const errors_default = {
        name: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_name" },
        email: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_email" },
        phone: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_phone" },
        country: { fill: true, validate: true, fill_message: "fill_field" },
        city: { fill: true, validate: true, fill_message: "fill_field" },
        cardNumber: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_cardNumber" },
        month: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_month" },
        year: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_year" },
        cvv: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_cvv" },
        bitcoinAddress: { fill: true, validate: true, fill_message: "fill_field", validate_message: "validate_message_bitcoinAddress" }
    }
    const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

    const [paymentDetails, setPaymentDetails] = useState({ ...payment_details, option: 'upi' })
    const [editCardNumber, setEditCardNumber] = useState(false)
    const [paymentError, setPaymentError] = useState(errors_default)
    const [countries, setCountries] = useState([])
    const [cities, setCities] = useState([])
    const [filteredCountries, setFilteredCountries] = useState([])
    const [filteredCountry, setFilteredCountry] = useState("")
    const [filteredCities, setFilteredCities] = useState([])
    const [filteredCity, setFilteredCity] = useState("")
    const monthOptions = checkoutData().monthOptions
    const yearOptions = checkoutData().yearOptions

    const [total, setTotal] = useState(0)
    const [totalPromo, setTotalPromo] = useState(0)
    const [qty, setQty] = useState(1)

    let market = home.market ? home.market : []

    useEffect(() => {
        let pay = 0
        switch (template) {
            case "buy_carrots":
                pay = qty * price_per_carrot
                break
            case "checkout":
                pay = totalPriceSum()
                setTotal(parseFloat(pay))
                if (promo && Object.keys(promo).length > 0) {
                    pay = (pay - (pay * promo.discount) / 100).toFixed(2)
                }
                break
            default:
                break
        }
        setTotalPromo(parseFloat(pay))
    }, [])

    function totalPriceSum() {
        let total = 0
        for (let i in cart) {
            let product = market.filter(a => a.id === cart[i].id)
            if (product && product[0] && product[0].price) {
                total = total + product[0].price * cart[i].qty
            }
        }
        return total.toFixed(2)
    }

    useEffect(() => {
        const countryNames = Object.keys(countriesData)
        setCountries(countryNames)
        setFilteredCountries(countryNames)
    }, [])

    function handleBack(choice = null) {
        if (choice) {
            dispatch(changePage('Salon'))
            dispatch(changeGame(null))
            dispatch(changeGamePage(choice))
        }
    }

    function handleChangeCheck(value) {
        let payload = { ...paymentDetails, option: value }
        setPaymentDetails(payload)
        dispatch(updatePaymentDetails(payload))
    }

    function handleInputChange(e) {
        const { name, value } = e.target
        setPaymentDetails({ ...paymentDetails, [name]: value })
    }

    function handleCountryChange(value) {
        const selectedCountry = value
        setPaymentDetails({ ...paymentDetails, country: selectedCountry, city: "" })
        const selectedCities = countriesData[selectedCountry] || []
        setCities(selectedCities)
        setFilteredCities(selectedCities)
        setFilteredCity("")
    }

    function handleFilterCountries(e) {
        const filtered = countries.filter(country => country.toLowerCase().includes(e.toLowerCase()))

        setFilteredCountries(filtered)
        setFilteredCountry(e)

        setFilteredCities([])
        setFilteredCity("")
    }

    function handleCityChange(value) {
        setPaymentDetails({ ...paymentDetails, city: value })
    }

    function handleFilterCities(e) {
        const filtered = cities.filter(city => city.toLowerCase().includes(e.toLowerCase()))
        setFilteredCities(filtered)
        setFilteredCity(e)
    }

    function changeMonth(value) {
        setPaymentDetails({ ...paymentDetails, month: value })
    }
    function changeYear(value) {
        setPaymentDetails({ ...paymentDetails, year: value })
    }

    function handleEditCardNumber() {
        setEditCardNumber(true)
    }

    function handleSaveCardNumber() {
        setEditCardNumber(false)
    }

    function checkCardForm() {
        const { cardNumber, month, year, cvv } = paymentDetails
        let errors = errors_default

        if (isEmpty(cardNumber)) {
            errors.cardNumber.fill = false
        }
        if (parseInt(month) === -1) {
            errors.month.fill = false
        }
        if (isEmpty(year)) {
            errors.year.fill = false
        }
        if (isEmpty(cvv)) {
            errors.cvv.fill = false
        }

        if (!validateCard(cardNumber)) { // test card details --> 4242424242424242
            errors.cardNumber.validate = false
            errors.month.validate = false
            errors.year.validate = false
            errors.cvv.validate = false
        }

        return errors
    }

    function validateForm() {
        let errors = null
        let problem = false

        if (paymentDetails.option === "stripe") {
            errors = checkCardForm()
            setPaymentError(errors)
            problem = Object.values(errors).some(error => !error.fill || !error.validate) // Check if there is any problem (fill or validate errors for at least one element in error array)
        }

        return problem
    }

    function checkMinimunAmountToPass() {
        let problem = false

        switch (paymentDetails.option) {
            case "stripe":
            case "paypal":
                if (minimum_amount > totalPromo) {
                    problem = true
                }
                break
        }

        return problem
    }

    function handleContinue() {
        if (!validateForm()) {
            dispatch(updatePaymentDetails({ ...paymentDetails }))
            checkMinimunAmountToPass()
        }
    }

    function updateQty(value) {
        setQty(value)
        setTotalPromo(value * price_per_carrot)
    }

    function handleUpiPaymentSuccess() {
        let payload = {
            open: true,
            template: "success",
            title: translate({ lang, info: "success" }),
            data: translate({ lang, info: "payment_success_wait" }),
            size: 'sm',
        }
        dispatch(changePopup(payload))
        setTimeout(() => {
            handleBack("dashboard")
        }, 3000)
    }

    function handleUpiPaymentFailure() {
        let payload = {
            open: true,
            template: "error",
            title: translate({ lang, info: "error" }),
            data: translate({ lang, info: "payment_failed" }), // "Payment Failed"
            size: 'sm',
        }
        dispatch(changePopup(payload))
        setTimeout(() => {
            handleBack("dashboard")
        }, 3000)
    }

    // function showError(data = {}) {
    //     console.error(data)
    //     let payload = {
    //         open: true,
    //         template: "error",
    //         title: translate({ lang, info: "error" }),
    //         data: translate({ lang, info: data.payload && typeof data.payload === "string" ? data.payload : "error_charge" }),
    //         size: 'sm',
    //     }
    //     dispatch(changePopup(payload))
    // }

    return <form id="payment_form">
        <Row>
            <Col sm={4} className="payment_cart_container">
                <PaymentCart
                    {...props}
                    cart={cart}
                    promo={promo}
                    totalPromo={totalPromo}
                    total={total}
                    qty={qty}
                    maxAmount={maxAmount}
                    updateQty={(e) => updateQty(e)}
                />
            </Col>
            <Col sm={8} className="payment_form_container">
                <PaymentForm
                    {...props}
                    paymentDetails={paymentDetails}
                    amount={totalPromo}
                    minimum_amount_inr={minimum_amount_inr}
                    minimum_amount={minimum_amount}
                    editCardNumber={editCardNumber}
                    paymentError={paymentError}
                    filteredCountries={filteredCountries}
                    filteredCountry={filteredCountry}
                    filteredCities={filteredCities}
                    filteredCity={filteredCity}
                    monthOptions={monthOptions}
                    yearOptions={yearOptions}
                    months={months}
                    template={template}
                    handleCountryChange={(e) => handleCountryChange(e)}
                    handleFilterCountries={(e) => handleFilterCountries(e)}
                    handleCityChange={(e) => handleCityChange(e)}
                    handleFilterCities={(e) => handleFilterCities(e)}
                    handleChangeCheck={(e) => handleChangeCheck(e)}
                    handleInputChange={(e) => handleInputChange(e)}
                    handleEditCardNumber={() => handleEditCardNumber()}
                    handleSaveCardNumber={() => handleSaveCardNumber()}
                    changeMonth={(e) => changeMonth(e)}
                    changeYear={(e) => changeYear(e)}
                    handleContinue={() => handleContinue()}
                    handleBack={(e) => handleBack(e)}
                    handleUpiPaymentSuccess={handleUpiPaymentSuccess}
                    handleUpiPaymentFailure={handleUpiPaymentFailure}
                />
            </Col>
        </Row>
    </form>
}
export default Payment