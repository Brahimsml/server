function WelcomeButton() {
const welcome = () => {
alert("You clicked me");
};
return (
<button onClick={welcome}>
Click Me!
</button>
);
}
export default WelcomeButton;