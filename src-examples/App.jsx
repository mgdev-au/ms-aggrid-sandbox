import React, {Component} from "react";
import {Redirect, Route, Switch} from "react-router-dom";

import NavItem from "./NavItem";
import RichGridDeclarativeExample from "./richGridDeclarativeExample/RichGridDeclarativeExample";
import SimpleReduxDynamicExample from "./simpleReduxDynamicComponentExample/SimpleReduxExample";
import SimpleReduxHookExample from "./simpleReduxHooksExample/SimpleReduxHookExample";
import MilestoneTestRig from "./milestoneTestRig/MilestoneTestRig";
import MilestoneTestRig_2 from "./milestoneTestRig/MilestoneTestRig_2";
import MilestoneTestRig_3 from "./milestoneTestRig/MilestoneTestRig_3";
import MilestoneTestRig_4 from "./milestoneTestRig/MilestoneTestRig_4";
import MilestoneTestRig_5 from "./milestoneTestRig/MilestoneTestRig_5";
// import MilestoneTestRig_MGTable from "./milestoneTestRig/MilestoneTestRig_MGTable";
import MilestoneTestRig_PredefGrouping from "./milestoneTestRig/MilestoneTestRig_PredefGrouping";

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
            <NavItem to='/milestone-aggrid2'>Milestone - agGrid Sample (Edge Editors)</NavItem>
       </ul>
      <hr/>
      <h3>Milestone PoC</h3>
      <ul className="nav nav-pills">
        <NavItem to='/milestone-aggrid3'>Milestone - agGrid Sample (Master/Detail Grid)</NavItem>
        <NavItem to='/milestone-aggrid4'>Milestone - agGrid Sample (Master/Detail Grid Nesting)</NavItem>
        <NavItem to='/milestone-aggrid5'>Milestone - agGrid Sample (Master/Detail Custom)</NavItem>
        <NavItem to='/milestone_pregrouping'>Milestone - agGrid Sample (PreDef Grouping)</NavItem>
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
                        <Route exact path='/milestone-aggrid3' component={MilestoneTestRig_3}/>
                        <Route exact path='/milestone-aggrid4' component={MilestoneTestRig_4}/>
                        <Route exact path='/milestone-aggrid5' component={MilestoneTestRig_5}/>
                        {/* <Route exact path='/milestone-mgtable' component={MilestoneTestRig_MGTable}/> */}
                        <Route exact path='/milestone_pregrouping' component={MilestoneTestRig_PredefGrouping}/>
                    </Switch>
                </div>
            </div>
        )
    }
}

export default App
