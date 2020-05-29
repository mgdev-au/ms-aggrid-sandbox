import React, {Component} from "react";
import {Redirect, Route, Switch} from "react-router-dom";

import NavItem from "./NavItem";
import RichGridDeclarativeExample from "./richGridDeclarativeExample/RichGridDeclarativeExample";
import SimpleReduxDynamicExample from "./simpleReduxDynamicComponentExample/SimpleReduxExample";
import SimpleReduxHookExample from "./simpleReduxHooksExample/SimpleReduxHookExample";
import MilestoneTestRig from "./milestoneTestRig/MilestoneTestRig";
import MilestoneTestRig_2 from "./milestoneTestRig/MilestoneTestRig_2";
// import MilestoneTestRig_3 from "./milestoneTestRig/MilestoneTestRig_3";

const SideBar = () => (
    <div style={{float: "left", width: 335, marginRight: 25}}>
        <h3>agGrid Samples</h3>    
        <ul className="nav nav-pills">
            <NavItem to='/rich-grid-declarative'>Rich Grid with Declarative Markup </NavItem>
            <NavItem to='/simple-redux-dynamic'>Simple Redux Dynamic Component Example</NavItem>
            <NavItem to='/simple-redux-hook'>Simple React Hook Component Example</NavItem>
        </ul>
        <hr/>
        <h3>Milestone Samples</h3>    
        <ul className="nav nav-pills">
            <NavItem to='/milestone-aggrid'>Milestone - agGrid Sample (Declarative)</NavItem>
            <NavItem to='/milestone-aggrid2'>Milestone - agGrid Sample</NavItem>
            {/* <NavItem to='/milestone-mgtable'>Milestone - MGTable Sample</NavItem> */}
       </ul>
    </div>
);

class App extends Component {
    render() {
        return (
            <div style={{display: "inline-block", width: "100%"}}>
                <SideBar/>
                <div style={{float: "left"}}>
                    <Switch>
                        <Redirect from="/" exact to="/rich-grid-declarative"/>
                        <Route exact path='/rich-grid-declarative' component={RichGridDeclarativeExample}/>
                        <Route exact path='/simple-redux-dynamic' component={SimpleReduxDynamicExample}/>
                        <Route exact path='/simple-redux-hook' component={SimpleReduxHookExample}/>
                        <Route exact path='/milestone-aggrid' component={MilestoneTestRig}/>
                        <Route exact path='/milestone-aggrid2' component={MilestoneTestRig_2}/>
                        {/* <Route exact path='/milestone-mgtable' component={MilestoneTestRig_3}/> */}
                    </Switch>
                </div>
            </div>
        )
    }
}

export default App
