import React from 'react'
import { translate } from '../../../translations/translate'
import { Row, Col, Button } from 'react-bootstrap'
import RazorpayCheckout from './type/razorpay'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStore, faUser } from '@fortawesome/free-solid-svg-icons'

function PaymentForm(props) {
    const {
        template, settings,
        handleBack
    } = props
    const { lang } = settings

    return <>
        <Row>
            <Col sm={12}>
                <div className="payment_details_title">
                    <h3>{translate({ lang, info: "pay_upi" })}</h3>
                </div>
            </Col>
        </Row>

        {/* Rendering the new Razorpay Checkout Component */}
        <RazorpayCheckout {...props} />

        <Row>
            <Col sm={12} className="button_action_group button_action_group_checkout">
                {(() => {
                    let choice = null
                    let icon = null
                    switch (template) {
                        case "buy_carrots":
                            choice = "dashboard"
                            icon = faUser
                            break
                        case "checkout":
                            choice = "market"
                            icon = faStore
                            break
                        default:
                    }
                    return <>{choice && icon ? <Button
                        type="button"
                        className="mybutton button_fullcolor shadow_convex"
                        onClick={() => handleBack(choice)}
                    ><FontAwesomeIcon icon={icon} /> {translate({ lang, info: choice })}</Button> : null}</>
                })()}
            </Col>
        </Row>
    </>
}
export default PaymentForm