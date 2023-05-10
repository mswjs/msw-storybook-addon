type StatusTextMap = {
  [key: string]: string;
};

const statusTextMap: StatusTextMap = {
  200: "OK",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
};

export default statusTextMap;
