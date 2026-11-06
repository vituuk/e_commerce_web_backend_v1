// error with an HTTP status, thrown by services and turned into a response by controllers
class AppError extends Error{
    constructor(status,message){
        super(message);
        this.status=status;
    }
}

module.exports=AppError;
