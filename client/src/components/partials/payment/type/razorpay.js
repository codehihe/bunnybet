import React, { useState, useEffect } from 'react'
import { Col, Row, Button } from 'react-bootstrap'
import { useSelector } from 'react-redux'
import { translate } from "../../../../translations/translate"
import { convertCurrency, postData } from '../../../../utils/utils'
import Spinner from '../../spinner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faTimesCircle, faShieldAlt } from '@fortawesome/free-solid-svg-icons'


function RazorpayCheckout(props) {
    const {
        amount, settings, exchange_rates, template,
        handleUpiPaymentSuccess, handleUpiPaymentFailure // Reused props for standardizing success/fail callback
    } = props
    const { lang, currency } = settings
    const user = useSelector(state => state.auth.user)

    // Convert amount to INR since Razorpay primary currency in India is INR
    const amountInInr = currency === 'INR' ? amount : convertCurrency(amount, currency, exchange_rates, true, "INR")

    // Amount in subunits (paise) for Razorpay API
    let amountInPaise = Math.round(amountInInr * 100)
    if (amountInPaise < 100) {
        amountInPaise = 100 // minimum amount is 1 INR
    }

    const [paymentStatus, setPaymentStatus] = useState('ready') // ready, loading, pending, success, failed
    const [errorMsg, setErrorMsg] = useState("")

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true)
                return
            }
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => {
                resolve(true)
            }
            script.onerror = () => {
                resolve(false)
            }
            document.body.appendChild(script)
        })
    }

    const initiatePayment = async () => {
        if (!user || !user.uuid) {
            setErrorMsg("User not authenticated")
            setPaymentStatus('failed')
            return
        }

        setPaymentStatus('loading')
        setErrorMsg("")

        const resScript = await loadRazorpayScript()

        if (!resScript) {
            setErrorMsg("Razorpay SDK failed to load. Are you online?")
            setPaymentStatus('failed')
            return
        }

        if (!process.env.REACT_APP_RAZORPAY_KEY_ID) {
            setErrorMsg("Razorpay Key ID missing. Please add REACT_APP_RAZORPAY_KEY_ID to client/.env and restart the React server.")
            setPaymentStatus('failed')
            return
        }

        // Razorpay receipts max 40 chars. uuid is 40 chars. 
        // We substring uuid to 20 chars to leave room for the prefix and timestamp.
        const shortUuid = user.uuid.substring(0, 20)
        const receiptString = `rcpt_${shortUuid}_${Date.now()}` // ~38 chars long

        const payload = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: receiptString,
            notes: {
                description: template === "buy_carrots" ? "Buy carrots" : "Buy vegetables",
                uuid: user.uuid
            }
        }

        postData('/api/razorpay/order', payload).then((res) => {
            if (res && res.success && res.order) {
                setPaymentStatus('pending')
                displayRazorpayModal(res.order)
            } else {
                setPaymentStatus('failed')
                setErrorMsg(res?.message || "Order creation failed")
                console.error("Order creation failed", res)
            }
        }).catch(err => {
            setPaymentStatus('failed')
            setErrorMsg("Network error or server unavailable")
            console.error("Order creation error", err)
        })
    }

    const displayRazorpayModal = (order) => {
        const options = {
            key: process.env.REACT_APP_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
            amount: order.amount.toString(),
            currency: order.currency,
            name: "Bunnybet",
            description: template === "buy_carrots" ? "Buy carrots" : "Buy vegetables",
            image: "https://ik.imagekit.io/zzht49lkb/bunnybet/BunnyBet.png", // Optional: Add a logo later
            order_id: order.id,
            handler: function (response) {
                verifyPayment(response, order)
            },
            prefill: {
                name: user ? user.user : "Customer",
                email: user ? user.email : "",
                contact: ""
            },
            notes: {
                address: "Bunnybet User"
            },
            theme: {
                color: "#ffc107" // Bootstrap warning color to match theme
            },
            modal: {
                ondismiss: function () {
                    setPaymentStatus('failed')
                    setErrorMsg("Payment modal closed by user")
                    if (handleUpiPaymentFailure) handleUpiPaymentFailure()
                }
            }
        }

        const paymentObject = new window.Razorpay(options)

        paymentObject.on('payment.failed', function (response) {
            console.error(response.error)
            setPaymentStatus('failed')
            setErrorMsg(response.error.description)
            if (handleUpiPaymentFailure) handleUpiPaymentFailure()
        })

        paymentObject.open()
    }

    const verifyPayment = (paymentResponse, order) => {
        setPaymentStatus('loading')

        const payload = {
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
            amount: order.amount,
            currency: order.currency,
            uuid: user.uuid,
            description: template === "buy_carrots" ? "Buy carrots" : "Buy vegetables"
        }

        postData('/api/razorpay/verify', payload).then((res) => {
            if (res && res.success) {
                setPaymentStatus('success')
                setTimeout(() => {
                    // Emit order_send to trigger the Redux updates and popup in Home component
                    if (props.socket) {
                        let details = {
                            method: "razorpay",
                            uuid: user.uuid,
                            payment_id: paymentResponse.razorpay_payment_id,
                            order_date: new Date().getTime(),
                            amount: amountInInr,
                            status: 'success',
                            description: template === "buy_carrots" ? "Buy carrots" : "Buy vegetables",
                            currency: 'INR',
                            currencyExchange: currency,
                            exchange_rates: exchange_rates,
                            carrots_update: template === "buy_carrots" ? amountInInr / 85 : 0 // Assuming price_per_carrot = 85
                        }
                        props.socket.emit('order_send', details)
                    }

                    if (handleUpiPaymentSuccess) handleUpiPaymentSuccess({
                        amount: amountInInr,
                        currency: 'INR',
                        method: 'Razorpay',
                        transactionId: paymentResponse.razorpay_payment_id
                    })
                }, 2000)
            } else {
                setPaymentStatus('failed')
                setErrorMsg(res?.message || "Payment signature verification failed")
            }
        }).catch(err => {
            setPaymentStatus('failed')
            setErrorMsg("Network error during verification")
            console.error("Verification error", err)
        })
    }

    useEffect(() => {
        // initiatePayment() // Removed auto-initiation to allow user to see changing cart totals
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return <Row id="payment_form_razorpay">
        <Col sm={12}>
            <div className="payment_razorpay_container text-center">

                {paymentStatus === 'ready' && (
                    <div className="py-4">
                        <h4 className="mb-4">Total Amount: {amountInInr} {currency}</h4>
                        <Button variant="warning" size="lg" className="px-5 font-weight-bold shadow-sm text-dark" onClick={initiatePayment}>
                            Pay Now
                        </Button>
                    </div>
                )}

                {paymentStatus === 'loading' && (
                    <div className="py-5">
                        <Spinner />
                        <p className="mt-3 text-light">Initializing secure payment gateway...</p>
                        <p className="small text-muted"><FontAwesomeIcon icon={faShieldAlt} /> Secured by Razorpay</p>
                    </div>
                )}

                {paymentStatus === 'pending' && (
                    <div className="py-5">
                        <h4>{translate({ lang, info: "payment_in_progress" })}</h4>
                        <p className="text-muted">Please complete the payment in the Razorpay popup window.</p>
                        <p className="mt-2 text-warning">Do not close or refresh this page.</p>
                    </div>
                )}

                {paymentStatus === 'success' && (
                    <div className="alert alert-success mt-3 py-4 shadow-sm">
                        <FontAwesomeIcon icon={faCheckCircle} size="3x" className="mb-3" />
                        <h5>Payment Successful!</h5>
                        <p className="mb-0 text-muted">Your transaction has been verified.</p>
                        <p className="mt-2 font-weight-bold">Redirecting you back...</p>
                    </div>
                )}

                {paymentStatus === 'failed' && (
                    <div className="alert alert-danger mt-3 py-4 shadow-sm">
                        <FontAwesomeIcon icon={faTimesCircle} size="3x" className="mb-3" />
                        <h5 className="mb-3">Payment Failed or Cancelled</h5>
                        {errorMsg && <p className="small text-dark opacity-75 mb-3">{errorMsg}</p>}
                        <p className="mb-3 text-muted">You can update your cart and try paying again.</p>
                        <div className="d-flex justify-content-center gap-2 flex-column align-items-center">
                            <h5 className="mb-3 text-warning">New Total: {amountInInr} {currency}</h5>
                            <Button variant="danger" size="lg" className="px-5 font-weight-bold" onClick={initiatePayment}>
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Col>
    </Row>
}

export default RazorpayCheckout
