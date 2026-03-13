import React from 'react'
import { translate } from '../../../translations/translate'
import { Row, Col, Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { convertCurrency } from '../../../utils/utils'
import { faStore, faUser, faCartShopping, faArrowRotateLeft } from '@fortawesome/free-solid-svg-icons'
import Spinner from '../spinner'

function PaymentDetails(props) {
    const {
        paymentDetails, template, settings, paymentSending, amount, fiatEquivalent, cryptoArray, exchange_rates,
        handleSendPayment, handleBack
    } = props
    const { lang, currency } = settings

    const cryptoDetails = cryptoArray.find(item => item.value === fiatEquivalent.currency_to)

    return <>
        <p>{translate({ lang, info: "under_construction" })}</p>
        {paymentDetails ? <>
            <Row id="payment_details">
                <Col sm={8}>
                    <Row>
                        <Col sm={12} className="payment_details_box">
                            <div className="payment_details_title">
                                <h3>{translate({ lang, info: "payment_info" })}</h3>
                            </div>
                            <div className="payment_details_body">
                                <p><strong>{translate({ lang, info: "payment_methode" })}:</strong> {translate({ lang, info: "crypto" })}</p>
                                <p><strong>{translate({ lang, info: "crypto" })}:</strong> {cryptoDetails ? cryptoDetails.text : "-"}</p>
                                <p><strong>{translate({ lang, info: "your_amount_in_fiat_equivalent" })}:</strong> {fiatEquivalent.estimated_amount} {fiatEquivalent.currency_to}</p>
                            </div>
                        </Col>
                    </Row>
                </Col>
                <Col sm={4}>
                    <Row>
                        <Col sm={12}>
                            <div className="payment_details_total_price 2">
                                <h3>
                                    <b>{translate({ lang, info: "total_price" })}</b>: {convertCurrency(amount, currency, exchange_rates)} {currency}
                                </h3>
                            </div>
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={12} className="button_action_group">
                            <Button
                                type="button"
                                className="mybutton button_fullcolor shadow_convex"
                                onClick={() => handleSendPayment()}
                            >{paymentSending ? <>
                                <Spinner size="small" color="black" />
                            </> : <>
                                <FontAwesomeIcon icon={faCartShopping} /> {translate({ lang, info: "pay" })}
                            </>}</Button>
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
                                }
                                return <>{choice && icon ? <Button
                                    type="button"
                                    className="mybutton button_fullcolor shadow_convex"
                                    onClick={() => handleBack(choice)}
                                ><FontAwesomeIcon icon={icon} /> {translate({ lang, info: choice })}</Button> : null}</>
                            })()}
                        </Col>
                    </Row>
                </Col>
            </Row>
        </> : <p>{translate({ lang, info: "error" })}</p>}
        <div className="button_action_group payment_buttons_container">
            <div className="tooltip">
                <Button
                    type="button"
                    className="mybutton round button_transparent shadow_convex"
                    onClick={() => handleBack()}
                ><FontAwesomeIcon icon={faArrowRotateLeft} /></Button>
                <span className="tooltiptext">{translate({ lang, info: "back" })}</span>
            </div>
        </div>
    </>
}
export default PaymentDetails