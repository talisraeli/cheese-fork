// An error the API returns to the client: an HTTP status and a code that clients can check.
class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export { ApiError };
