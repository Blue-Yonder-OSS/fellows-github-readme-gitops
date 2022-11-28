declare module "*.json"
{ const value: any;
    export default value;
}

// This will allow you to load JSON from remote URL responses

declare module "json!*"
{ const value: any;
    export default value;
}