import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth";
import App from "./App";

let originalRequestAnimationFrame;
let originalCancelAnimationFrame;

beforeEach(() => {
  global.fetch = jest.fn();
  originalRequestAnimationFrame = global.requestAnimationFrame;
  originalCancelAnimationFrame = global.cancelAnimationFrame;
});

afterEach(() => {
  delete global.fetch;
  if (originalRequestAnimationFrame) {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  } else {
    delete global.requestAnimationFrame;
  }
  if (originalCancelAnimationFrame) {
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  } else {
    delete global.cancelAnimationFrame;
  }
  jest.restoreAllMocks();
});

test("shows the welcome page before opening login", async () => {
  render(<Auth onAuthenticated={jest.fn()} />);

  expect(screen.getByText("Find your people. Feel the pulse.")).toBeInTheDocument();
  expect(screen.queryByLabelText("USERNAME")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "LOG IN" }));
  expect(screen.getByLabelText("USERNAME")).toBeInTheDocument();
});

test("submits login credentials and passes the authenticated account to the app", async () => {
  const account = {
    user: { id: "1", username: "user" },
    profile: { name: "USER", ig: "user", venue: { name: "FABRIC LONDON" } },
  };
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => account,
  });
  const onAuthenticated = jest.fn();

  render(<Auth onAuthenticated={onAuthenticated} />);
  fireEvent.click(screen.getByRole("button", { name: "LOG IN" }));
  await userEvent.type(screen.getByLabelText("USERNAME"), "user");
  await userEvent.type(screen.getByLabelText("PASSWORD"), "user123");
  fireEvent.click(screen.getByRole("button", { name: "SIGN IN →" }));

  await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(account));
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/auth/login",
    expect.objectContaining({ credentials: "same-origin", method: "POST" })
  );
});

test("shows backend errors without losing the entered username", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Incorrect username or password." }),
  });

  render(<Auth onAuthenticated={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "LOG IN" }));
  const username = screen.getByLabelText("USERNAME");
  await userEvent.type(username, "user");
  await userEvent.type(screen.getByLabelText("PASSWORD"), "wrong");
  fireEvent.click(screen.getByRole("button", { name: "SIGN IN →" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Incorrect username or password."
  );
  expect(username).toHaveValue("user");
});

test("opens and closes a matched chat without an effect cleanup error", async () => {
  const context = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = jest.fn();
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      user: { id: "1", username: "user" },
      profile: { name: "USER", ig: "user", venue: { name: "FABRIC LONDON" } },
    }),
  });

  const { unmount } = render(<App />);
  fireEvent.click(await screen.findByText("NEARBY"));
  fireEvent.click(screen.getAllByText("💬")[0]);
  expect(await screen.findByText("Hey are you near the bar?")).toBeInTheDocument();
  fireEvent.click(screen.getByText("✕"));
  expect(screen.queryByText("Hey are you near the bar?")).not.toBeInTheDocument();
  unmount();
});
