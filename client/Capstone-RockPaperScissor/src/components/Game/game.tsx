import React from "react";
import * as io from "socket.io-client"; // import all req for typescript
import Button from "@mui/material/Button"

//connection to backend server
const socket = io.connect("http://localhost:3001");

export function Game() {
    
    function handleClick(value: string) {
        
        console.log(value);
        socket.emit("user_choice", value);
    }
    
    return (
        <>
            <Button 
            variant="contained"
            onClick = {() => handleClick("Rock")}
            value = "Rock" >  
                Rock
            </Button>
            
            <Button 
            variant="contained"
            onClick = {() => handleClick("Paper")}
            value = "Paper" >
                Paper
            </Button>
            
            <Button 
            variant="contained"
            onClick = {() => handleClick("Scissor")}
            value = "Scissor" >
                Scissor
            </Button>
        </>

    )
};
