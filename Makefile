build_and_push_dev:
	docker build -t pppoe15/fm-ui:dev .
	docker login
	docker push pppoe15/fm-ui:dev
