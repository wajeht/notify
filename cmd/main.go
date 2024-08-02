package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type Notification struct {
	Type    string  `json:"type"`
	Message string  `json:"message"`
	Details *string `json:"details,omitempty"`
}

func getHealthzHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Welcome to the notification service"))
}

func getIndexHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Welcome to the notification service"))
}

func postNotificationHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)

	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	defer r.Body.Close()

	var notification Notification

	err = json.Unmarshal(body, &notification)

	if err != nil {
		http.Error(w, "Error parsing JSON", http.StatusBadRequest)
		return
	}

	if notification.Type != "discord" && notification.Type != "email" && notification.Type != "sms" {
		http.Error(w, "Invalid notification type", http.StatusBadRequest)
		return
	}

	fmt.Printf("Received %s notification: %s\n", notification.Type, notification.Message)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Notification received"))
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /", getIndexHandler)
	mux.HandleFunc("GET /healthz", getHealthzHandler)
	mux.HandleFunc("POST /", postNotificationHandler)

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	log.Println("Server starting on http://localhost:8080")

	log.Fatal(server.ListenAndServe())
}
