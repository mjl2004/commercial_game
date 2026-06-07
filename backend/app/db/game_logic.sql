CREATE SCHEMA IF NOT EXISTS game_logic;

DROP FUNCTION IF EXISTS game_logic.start_session(JSONB);
DROP FUNCTION IF EXISTS game_logic.start_session(TEXT);
DROP FUNCTION IF EXISTS game_logic.execute_trade(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.execute_trade(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.deposit_warehouse(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.deposit_warehouse(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.withdraw_warehouse(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.withdraw_warehouse(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.start_move(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.start_move(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.resolve_encounter(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.resolve_encounter(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.finalize_encounter(JSONB);
DROP FUNCTION IF EXISTS game_logic.finalize_encounter(TEXT);
DROP FUNCTION IF EXISTS game_logic.advance_world(JSONB, JSONB);
DROP FUNCTION IF EXISTS game_logic.advance_world(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.evaluate_settlement(TEXT);
DROP FUNCTION IF EXISTS game_logic.complete_settlement(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.get_account(TEXT);
DROP FUNCTION IF EXISTS game_logic.get_leaderboard(INT);
DROP FUNCTION IF EXISTS game_logic.error_result(TEXT, TEXT);
DROP FUNCTION IF EXISTS game_logic.ok_result(JSONB, TEXT);

CREATE TABLE IF NOT EXISTS game_logic.encounter_pool (
    encounter_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    choices JSONB NOT NULL,
    sort_order INT NOT NULL UNIQUE
);

DELETE FROM game_logic.encounter_pool;

INSERT INTO game_logic.encounter_pool (encounter_id, title, description, choices, sort_order)
VALUES
    (
        'enc-merchant-cache',
        '漂流商队残骸',
        '你在航道边缘发现了一支失联商队的残骸，扫描显示还有一批可回收物资。',
        '[
            {"choiceId": 1, "text": "回收残余货物", "consequenceHint": "收益：650 CR | 风险：通缉等级 +1", "effect": {"creditsDelta": 650, "wantedLevelDelta": 1}},
            {"choiceId": 2, "text": "记录坐标后离开", "consequenceHint": "收益：无 | 风险：无", "effect": {}}
        ]'::jsonb,
        0
    ),
    (
        'enc-patrol-check',
        '临检巡逻队',
        '一支联邦巡逻编队要求你减速并接受临检，你可以花钱加快通关，或配合完成检查。',
        '[
            {"choiceId": 1, "text": "支付通行费用", "consequenceHint": "代价：300 CR | 风险：无", "effect": {"creditsDelta": -300}},
            {"choiceId": 2, "text": "接受完整检查", "consequenceHint": "收益：无 | 风险：额外消耗 1 世界年份", "effect": {"yearDelta": 1}}
        ]'::jsonb,
        1
    ),
    (
        'enc-smuggler-offer',
        '走私者报价',
        '一艘未注册飞船向你发来加密通讯，愿意出售一条灰色贸易情报，但会提高你的嫌疑。',
        '[
            {"choiceId": 1, "text": "购买情报", "consequenceHint": "收益：终止年份 +1 | 风险：通缉等级 +1", "effect": {"endYearDelta": 1, "wantedLevelDelta": 1}},
            {"choiceId": 2, "text": "拒绝并断开信道", "consequenceHint": "收益：无 | 风险：无", "effect": {}}
        ]'::jsonb,
        2
    );

CREATE OR REPLACE VIEW game_logic.session_player_summary AS
SELECT
    gs.session_id,
    gs.player_name,
    (gs.session_json::jsonb #>> '{player,credits}')::bigint AS credits,
    (gs.session_json::jsonb #>> '{player,currentStationId}')::int AS current_station_id,
    (gs.session_json::jsonb #>> '{player,wantedLevel}')::int AS wanted_level,
    (gs.session_json::jsonb #>> '{meta,currentYear}')::int AS current_year,
    (gs.session_json::jsonb #>> '{meta,endYear}')::int AS end_year
FROM game_sessions gs;

CREATE OR REPLACE VIEW game_logic.session_cargo_summary AS
SELECT
    NULL::VARCHAR(64) AS session_id,
    NULL::INT AS goods_id,
    NULL::INT AS quantity,
    NULL::INT AS avg_cost
WHERE FALSE;

CREATE OR REPLACE FUNCTION game_logic.now_iso()
RETURNS TEXT
LANGUAGE SQL
AS $$
    SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"');
$$;

CREATE OR REPLACE FUNCTION game_logic.error_result(error_code TEXT, error_message TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN '{"ok":false,"code":' || to_json(error_code)::text || ',"message":' || to_json(error_message)::text || '}';
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.ok_result(session_json JSONB, extra_fields TEXT DEFAULT '')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN '{"ok":true,"session":' || session_json::text || COALESCE(extra_fields, '') || '}';
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.set_json_value(target_json JSONB, path TEXT[], new_value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    key_count INT := COALESCE(array_length(path, 1), 0);
    target_key TEXT;
    current_value JSONB;
    result_parts TEXT[] := ARRAY[]::TEXT[];
    current_key TEXT;
    current_entry JSONB;
    next_value JSONB;
    found_target BOOLEAN := false;
BEGIN
    IF key_count = 0 THEN
        RETURN target_json;
    END IF;

    target_key := path[1];

    IF key_count = 1 THEN
        next_value := new_value;
    ELSE
        current_value := COALESCE(target_json -> target_key, '{}'::jsonb);
        next_value := game_logic.set_json_value(current_value, path[2:key_count], new_value);
    END IF;

    FOR current_key, current_entry IN
        SELECT key, value
        FROM jsonb_each(COALESCE(target_json, '{}'::jsonb))
    LOOP
        IF current_key = target_key THEN
            result_parts := array_append(result_parts, to_json(current_key)::text || ':' || next_value::text);
            found_target := true;
        ELSE
            result_parts := array_append(result_parts, to_json(current_key)::text || ':' || current_entry::text);
        END IF;
    END LOOP;

    IF NOT found_target THEN
        result_parts := array_append(result_parts, to_json(target_key)::text || ':' || next_value::text);
    END IF;

    RETURN ('{' || array_to_string(result_parts, ',') || '}')::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_station(session_json JSONB, station_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT station_item
    FROM jsonb_array_elements(COALESCE(session_json->'stations', '[]'::jsonb)) station_item
    WHERE (station_item->>'id')::INT = station_id_value
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.station_inventory_item(station_json JSONB, goods_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT inventory_item
    FROM jsonb_array_elements(COALESCE(station_json->'inventory', '[]'::jsonb)) inventory_item
    WHERE (inventory_item->>'goodsId')::INT = goods_id_value
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.cargo_used(cargo_json JSONB)
RETURNS INT
LANGUAGE SQL
AS $$
    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)::INT
    FROM jsonb_array_elements(COALESCE(cargo_json, '[]'::jsonb)) item;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_cargo_item(cargo_json JSONB, goods_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT cargo_item
    FROM jsonb_array_elements(COALESCE(cargo_json, '[]'::jsonb)) cargo_item
    WHERE (cargo_item->>'goodsId')::INT = goods_id_value
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.update_station_inventory(
    inventory_json JSONB,
    goods_id_value INT,
    stock_delta_value INT,
    next_price_value INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB := '[]'::jsonb;
    inventory_item JSONB;
    updated_item JSONB;
BEGIN
    FOR inventory_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(inventory_json, '[]'::jsonb))
    LOOP
        IF (inventory_item->>'goodsId')::INT = goods_id_value THEN
            updated_item := game_logic.build_trade_inventory_item(
                (inventory_item->>'goodsId')::INT,
                (inventory_item->>'stock')::INT + stock_delta_value,
                (inventory_item->>'basePrice')::INT,
                next_price_value,
                game_logic.append_price_history(inventory_item->'priceHistory', next_price_value)
            );
            result_json := game_logic.append_jsonb_array(result_json, updated_item);
        ELSE
            result_json := game_logic.append_jsonb_array(result_json, inventory_item);
        END IF;
    END LOOP;

    RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.update_stations_inventory(
    stations_json JSONB,
    station_id_value INT,
    goods_id_value INT,
    stock_delta_value INT,
    next_price_value INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB := '[]'::jsonb;
    station_item JSONB;
    updated_station JSONB;
BEGIN
    FOR station_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(stations_json, '[]'::jsonb))
    LOOP
        IF (station_item->>'id')::INT = station_id_value THEN
            updated_station := game_logic.build_station_with_inventory(
                station_item,
                game_logic.update_station_inventory(station_item->'inventory', goods_id_value, stock_delta_value, next_price_value)
            );
            result_json := game_logic.append_jsonb_array(result_json, updated_station);
        ELSE
            result_json := game_logic.append_jsonb_array(result_json, station_item);
        END IF;
    END LOOP;
    RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.update_station_inventory_only_stock(
    inventory_json JSONB,
    goods_id_value INT,
    stock_delta_value INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB := '[]'::jsonb;
    inventory_item JSONB;
    updated_item JSONB;
BEGIN
    FOR inventory_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(inventory_json, '[]'::jsonb))
    LOOP
        IF (inventory_item->>'goodsId')::INT = goods_id_value THEN
            updated_item := game_logic.build_trade_inventory_item(
                (inventory_item->>'goodsId')::INT,
                (inventory_item->>'stock')::INT + stock_delta_value,
                (inventory_item->>'basePrice')::INT,
                (inventory_item->>'currentPrice')::INT,
                COALESCE(inventory_item->'priceHistory', '[]'::jsonb)
            );
            result_json := game_logic.append_jsonb_array(result_json, updated_item);
        ELSE
            result_json := game_logic.append_jsonb_array(result_json, inventory_item);
        END IF;
    END LOOP;
    RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.update_stations_inventory_only_stock(
    stations_json JSONB,
    station_id_value INT,
    goods_id_value INT,
    stock_delta_value INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB := '[]'::jsonb;
    station_item JSONB;
    updated_station JSONB;
BEGIN
    FOR station_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(stations_json, '[]'::jsonb))
    LOOP
        IF (station_item->>'id')::INT = station_id_value THEN
            updated_station := game_logic.build_station_with_inventory(
                station_item,
                game_logic.update_station_inventory_only_stock(station_item->'inventory', goods_id_value, stock_delta_value)
            );
            result_json := game_logic.append_jsonb_array(result_json, updated_station);
        ELSE
            result_json := game_logic.append_jsonb_array(result_json, station_item);
        END IF;
    END LOOP;
    RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.calculate_withdraw_tax(quantity_value INT, wanted_level_value INT, stored_turns_value INT)
RETURNS INT
LANGUAGE SQL
AS $$
    SELECT ROUND(
        quantity_value
        * 12
        * (1 + stored_turns_value * 0.12)
        * CASE
            WHEN wanted_level_value <= 0 THEN 1
            WHEN wanted_level_value = 1 THEN 1.35
            WHEN wanted_level_value = 2 THEN 1.9
            ELSE 2.6
          END
    )::INT;
$$;

CREATE OR REPLACE FUNCTION game_logic.append_price_history(price_history JSONB, next_price INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    values_arr INT[] := ARRAY[]::INT[];
    value_text TEXT;
BEGIN
    FOR value_text IN
        SELECT value::TEXT
        FROM jsonb_array_elements(COALESCE(price_history, '[]'::jsonb))
    LOOP
        values_arr := array_append(values_arr, value_text::INT);
    END LOOP;

    values_arr := array_append(values_arr, next_price);

    WHILE COALESCE(array_length(values_arr, 1), 0) > 8 LOOP
        values_arr := ARRAY(
            SELECT values_arr[idx]
            FROM generate_subscripts(values_arr, 1) AS idx
            WHERE idx > 1
            ORDER BY idx
        );
    END LOOP;

    RETURN to_json(values_arr)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.compute_ripple_affected(routes_json JSONB, origin_station_id INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
WITH RECURSIVE routes_with_order AS (
    SELECT
        route,
        ROW_NUMBER() OVER () AS route_order
    FROM jsonb_array_elements(COALESCE(routes_json, '[]'::jsonb)) route
),
edges AS (
    SELECT
        (route->>'from')::INT AS from_station,
        (route->>'to')::INT AS to_station,
        route_order * 2 - 1 AS edge_order
    FROM routes_with_order
    UNION ALL
    SELECT
        (route->>'to')::INT AS from_station,
        (route->>'from')::INT AS to_station,
        route_order * 2 AS edge_order
    FROM routes_with_order
),
walk AS (
    SELECT origin_station_id AS station_id, 0 AS hop, ARRAY[origin_station_id]::INT[] AS path, 0::BIGINT AS visit_order
    UNION ALL
    SELECT e.to_station, w.hop + 1, w.path || e.to_station, w.visit_order * 100 + e.edge_order::BIGINT
    FROM walk w
    JOIN edges e ON e.from_station = w.station_id
    WHERE w.hop < 3
      AND NOT e.to_station = ANY(w.path)
),
best AS (
    SELECT station_id, MIN(hop) AS hop, MIN(visit_order) AS visit_order
    FROM walk
    WHERE hop > 0 AND hop <= 3
    GROUP BY station_id
)
SELECT COALESCE(
    json_agg(
        json_build_object('stationId', station_id, 'hop', hop)
        ORDER BY visit_order
    )::jsonb,
    '[]'::jsonb
)
FROM best;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_goods(goods_json JSONB, goods_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT goods_item
    FROM jsonb_array_elements(COALESCE(goods_json, '[]'::jsonb)) goods_item
    WHERE (goods_item->>'id')::INT = goods_id_value
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.sum_player_cargo_quantity(session_json JSONB, goods_id_value INT)
RETURNS INT
LANGUAGE SQL
AS $$
    SELECT COALESCE(SUM((cargo_item->>'quantity')::INT), 0)::INT
    FROM jsonb_array_elements(COALESCE(session_json #> '{player,cargo}', '[]'::jsonb)) cargo_item
    WHERE (cargo_item->>'goodsId')::INT = goods_id_value;
$$;

CREATE OR REPLACE FUNCTION game_logic.sum_warehouse_goods_quantity(session_json JSONB, goods_id_value INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    warehouse_bucket RECORD;
    warehouse_entry JSONB;
    total_value INT := 0;
BEGIN
    FOR warehouse_bucket IN
        SELECT key, value
        FROM jsonb_each(COALESCE(session_json->'warehouses', '{}'::jsonb))
    LOOP
        FOR warehouse_entry IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(warehouse_bucket.value, '[]'::jsonb))
        LOOP
            IF (warehouse_entry->>'goodsId')::INT = goods_id_value THEN
                total_value := total_value + COALESCE((warehouse_entry->>'quantity')::INT, 0);
            END IF;
        END LOOP;
    END LOOP;

    RETURN total_value;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.sum_market_goods_quantity(session_json JSONB, goods_id_value INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    station_item JSONB;
    inventory_item JSONB;
    total_value INT := 0;
BEGIN
    FOR station_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(session_json->'stations', '[]'::jsonb))
    LOOP
        FOR inventory_item IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(station_item->'inventory', '[]'::jsonb))
        LOOP
            IF (inventory_item->>'goodsId')::INT = goods_id_value THEN
                total_value := total_value + COALESCE((inventory_item->>'stock')::INT, 0);
            END IF;
        END LOOP;
    END LOOP;

    RETURN total_value;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.compute_monopoly_count(session_json JSONB)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    goods_item JSONB;
    goods_id_value INT;
    player_held_value INT;
    market_total_value INT;
    denominator_value INT;
    ratio_value NUMERIC;
    monopoly_count_value INT := 0;
BEGIN
    FOR goods_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(session_json->'goods', '[]'::jsonb))
    LOOP
        goods_id_value := (goods_item->>'id')::INT;
        player_held_value := game_logic.sum_player_cargo_quantity(session_json, goods_id_value)
            + game_logic.sum_warehouse_goods_quantity(session_json, goods_id_value);
        market_total_value := game_logic.sum_market_goods_quantity(session_json, goods_id_value);
        denominator_value := player_held_value + market_total_value;
        IF denominator_value > 0 THEN
            ratio_value := player_held_value::NUMERIC / denominator_value::NUMERIC;
        ELSE
            ratio_value := 0;
        END IF;
        IF ratio_value >= 0.8 THEN
            monopoly_count_value := monopoly_count_value + 1;
        END IF;
    END LOOP;

    RETURN monopoly_count_value;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.derive_settlement_result(session_json JSONB, monopoly_count_value INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    credits_value BIGINT := COALESCE((session_json #>> '{player,credits}')::BIGINT, 0);
    detained_years_value INT := COALESCE((session_json #>> '{player,detainedYears}')::INT, 0);
    player_status_value TEXT := COALESCE(session_json #>> '{player,status}', '');
    current_year_value INT := COALESCE((session_json #>> '{meta,currentYear}')::INT, 0);
    end_year_value INT := COALESCE((session_json #>> '{meta,endYear}')::INT, 0);
BEGIN
    IF monopoly_count_value > 0 THEN
        RETURN 'won';
    END IF;
    IF credits_value <= 0 OR detained_years_value > 18 OR player_status_value = 'LOST' THEN
        RETURN 'lost';
    END IF;
    IF current_year_value >= end_year_value OR player_status_value = 'TIMEUP' THEN
        RETURN 'timeup';
    END IF;
    IF player_status_value = 'WON' THEN
        RETURN 'won';
    END IF;
    RETURN 'timeup';
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.mask_email(email_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    name_value TEXT;
    domain_value TEXT;
BEGIN
    name_value := split_part(COALESCE(email_value, ''), '@', 1);
    domain_value := split_part(COALESCE(email_value, ''), '@', 2);

    IF name_value = '' OR domain_value = '' THEN
        RETURN email_value;
    END IF;
    IF LENGTH(name_value) <= 2 THEN
        RETURN substr(name_value, 1, 1) || '*@' || domain_value;
    END IF;
    RETURN substr(name_value, 1, 2) || '***@' || domain_value;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.serialize_account_row(
    account_id_value TEXT,
    email_value TEXT,
    password_mock_value TEXT,
    nickname_value TEXT,
    created_at_value TIMESTAMP,
    updated_at_value TIMESTAMP,
    best_score_value INT,
    best_score_updated_at_value TIMESTAMP
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        '{'
        || '"id":' || to_json(account_id_value)::text
        || ',"email":' || to_json(email_value)::text
        || ',"passwordMock":' || to_json(password_mock_value)::text
        || ',"nickname":' || to_json(nickname_value)::text
        || ',"createdAt":' || to_json(created_at_value::text)::text
        || ',"updatedAt":' || to_json(updated_at_value::text)::text
        || ',"bestScore":' || COALESCE(best_score_value, 0)::TEXT
        || ',"bestScoreUpdatedAt":' || COALESCE(to_json(best_score_updated_at_value::text)::text, 'null')
        || '}'
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.get_account(account_id_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    account_row RECORD;
BEGIN
    SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
    INTO account_row
    FROM public.accounts
    WHERE account_id = account_id_value
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 'null';
    END IF;

    RETURN game_logic.serialize_account_row(
        account_row.account_id,
        account_row.email,
        account_row.password_mock,
        account_row.nickname,
        account_row.created_at,
        account_row.updated_at,
        account_row.best_score,
        account_row.best_score_updated_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.get_leaderboard(limit_value INT DEFAULT 10)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    account_row RECORD;
    rank_value INT := 0;
    entry_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOR account_row IN
        SELECT account_id, email, nickname, best_score, best_score_updated_at
        FROM public.accounts
        WHERE best_score > 0
        ORDER BY best_score DESC, best_score_updated_at DESC NULLS LAST
        LIMIT limit_value
    LOOP
        rank_value := rank_value + 1;
        entry_parts := array_append(
            entry_parts,
            (
                '{'
                || '"rank":' || rank_value::TEXT
                || ',"accountId":' || to_json(account_row.account_id)::text
                || ',"nickname":' || to_json(account_row.nickname)::text
                || ',"emailMasked":' || to_json(game_logic.mask_email(account_row.email))::text
                || ',"bestScore":' || COALESCE(account_row.best_score, 0)::TEXT
                || ',"updatedAt":' || COALESCE(to_json(account_row.best_score_updated_at::text)::text, 'null')
                || '}'
            )
        );
    END LOOP;

    RETURN '[' || array_to_string(entry_parts, ',') || ']';
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_encounter(encounter_index_value INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    selected_encounter RECORD;
    encounter_count INT;
BEGIN
    SELECT COUNT(*) INTO encounter_count
    FROM game_logic.encounter_pool;

    IF COALESCE(encounter_count, 0) = 0 THEN
        RETURN NULL;
    END IF;

    SELECT encounter_id, title, description, choices
    INTO selected_encounter
    FROM game_logic.encounter_pool
    WHERE sort_order = MOD(encounter_index_value, encounter_count)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN (
        '{'
        || '"id":' || to_json(selected_encounter.encounter_id)::text
        || ',"title":' || to_json(selected_encounter.title)::text
        || ',"description":' || to_json(selected_encounter.description)::text
        || ',"choices":' || selected_encounter.choices::text
        || '}'
    )::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_route(routes_json JSONB, station_id_value INT, target_station_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT route_item
    FROM jsonb_array_elements(COALESCE(routes_json, '[]'::jsonb)) route_item
    WHERE (
        (route_item->>'from')::INT = station_id_value
        AND (route_item->>'to')::INT = target_station_id_value
    ) OR (
        (route_item->>'to')::INT = station_id_value
        AND (route_item->>'from')::INT = target_station_id_value
    )
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.append_jsonb_array(array_json JSONB, item_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(item_value)::jsonb, '[]'::jsonb)
        FROM (
            SELECT value AS item_value, 0 AS sort_order
            FROM jsonb_array_elements(COALESCE(array_json, '[]'::jsonb))
            UNION ALL
            SELECT item_json AS item_value, 1 AS sort_order
        ) appended_items
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.build_trade_inventory_item(
    goods_id_value INT,
    stock_value INT,
    base_price_value INT,
    current_price_value INT,
    price_history_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        '{'
        || '"goodsId":' || goods_id_value::TEXT
        || ',"stock":' || stock_value::TEXT
        || ',"basePrice":' || base_price_value::TEXT
        || ',"currentPrice":' || current_price_value::TEXT
        || ',"priceHistory":' || COALESCE(price_history_value::TEXT, '[]')
        || '}'
    )::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.build_station_with_inventory(
    station_json JSONB,
    inventory_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        '{'
        || '"id":' || COALESCE(station_json->>'id', '0')
        || ',"name":' || to_json(COALESCE(station_json->>'name', ''))::text
        || ',"x":' || COALESCE(station_json->>'x', '0')
        || ',"y":' || COALESCE(station_json->>'y', '0')
        || ',"security":' || to_json(COALESCE(station_json->>'security', ''))::text
        || ',"faction":' || to_json(COALESCE(station_json->>'faction', ''))::text
        || ',"inventory":' || COALESCE(inventory_json::text, '[]')
        || ',"independenceFactor":' || COALESCE(station_json->>'independenceFactor', '1')
        || '}'
    )::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.update_cargo(
    cargo_json JSONB,
    goods_json JSONB,
    quantity_value INT,
    unit_price_value INT,
    trade_type_value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB := '[]'::jsonb;
    cargo_item JSONB;
    found_item BOOLEAN := false;
    goods_id_value INT := (goods_json->>'id')::INT;
    total_quantity_value INT;
    updated_item JSONB;
BEGIN
    FOR cargo_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(cargo_json, '[]'::jsonb))
    LOOP
        IF (cargo_item->>'goodsId')::INT = goods_id_value THEN
            found_item := true;
            IF trade_type_value = 'buy' THEN
                total_quantity_value := (cargo_item->>'quantity')::INT + quantity_value;
                updated_item := json_build_object(
                    'goodsId', goods_id_value,
                    'goodsName', goods_json->>'name',
                    'quantity', total_quantity_value,
                    'avgCost', ROUND((((cargo_item->>'avgCost')::NUMERIC * (cargo_item->>'quantity')::NUMERIC) + (unit_price_value * quantity_value)) / total_quantity_value),
                    'isContraband', (goods_json->>'isContraband')::BOOLEAN
                )::jsonb;
                result_json := game_logic.append_jsonb_array(result_json, updated_item);
            ELSE
                total_quantity_value := (cargo_item->>'quantity')::INT - quantity_value;
                IF total_quantity_value > 0 THEN
                    updated_item := game_logic.set_json_value(cargo_item, ARRAY['quantity']::TEXT[], to_json(total_quantity_value)::jsonb);
                    result_json := game_logic.append_jsonb_array(result_json, updated_item);
                END IF;
            END IF;
        ELSE
            result_json := game_logic.append_jsonb_array(result_json, cargo_item);
        END IF;
    END LOOP;

    IF trade_type_value = 'buy' AND NOT found_item THEN
        result_json := game_logic.append_jsonb_array(
            result_json,
            json_build_object(
                'goodsId', goods_id_value,
                'goodsName', goods_json->>'name',
                'quantity', quantity_value,
                'avgCost', unit_price_value,
                'isContraband', (goods_json->>'isContraband')::BOOLEAN
            )
        ::jsonb);
    END IF;

    RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.check_failure_state(session_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    next_session JSONB := session_json;
    credits_value BIGINT := COALESCE((session_json #>> '{player,credits}')::BIGINT, 0);
    detained_years_value INT := COALESCE((session_json #>> '{player,detainedYears}')::INT, 0);
    current_year_value INT := COALESCE((session_json #>> '{meta,currentYear}')::INT, 0);
    end_year_value INT := COALESCE((session_json #>> '{meta,endYear}')::INT, 0);
BEGIN
    IF credits_value <= 0 THEN
        RETURN game_logic.set_json_value(next_session, ARRAY['player', 'status']::TEXT[], '"LOST"'::jsonb);
    END IF;

    IF detained_years_value > 18 THEN
        RETURN game_logic.set_json_value(next_session, ARRAY['player', 'status']::TEXT[], '"LOST"'::jsonb);
    END IF;

    IF current_year_value >= end_year_value THEN
        RETURN game_logic.set_json_value(next_session, ARRAY['player', 'status']::TEXT[], '"TIMEUP"'::jsonb);
    END IF;

    RETURN next_session;
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.advance_world_state(session_json JSONB, years_elapsed_value INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    next_session JSONB := session_json;
    current_year_value INT := COALESCE((session_json #>> '{meta,currentYear}')::INT, 2100);
    suspicion_value INT := COALESCE((session_json #>> '{player,suspicion}')::INT, 0);
    wanted_level_value INT := COALESCE((session_json #>> '{player,wantedLevel}')::INT, 0);
    warehouse_key TEXT;
    warehouse_entries JSONB;
    warehouse_entry JSONB;
    updated_entries JSONB;
BEGIN
    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'currentYear']::TEXT[], to_json(current_year_value + years_elapsed_value)::jsonb);

    FOR warehouse_key IN
        SELECT key
        FROM jsonb_each(COALESCE(next_session->'warehouses', '{}'::jsonb))
    LOOP
        warehouse_entries := next_session->'warehouses'->warehouse_key;
        updated_entries := '[]'::jsonb;
        FOR warehouse_entry IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(warehouse_entries, '[]'::jsonb))
        LOOP
            updated_entries := game_logic.append_jsonb_array(
                updated_entries,
                game_logic.set_json_value(
                    warehouse_entry,
                    ARRAY['storedTurns']::TEXT[],
                    to_json(COALESCE((warehouse_entry->>'storedTurns')::INT, 0) + years_elapsed_value)::jsonb
                )
            );
        END LOOP;
        next_session := game_logic.set_json_value(next_session, ARRAY['warehouses', warehouse_key]::TEXT[], updated_entries);
    END LOOP;

    suspicion_value := GREATEST(0, suspicion_value - years_elapsed_value * 5);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'suspicion']::TEXT[], to_json(suspicion_value)::jsonb);

    IF suspicion_value = 0 AND wanted_level_value > 0 THEN
        next_session := game_logic.set_json_value(next_session, ARRAY['player', 'wantedLevel']::TEXT[], to_json(GREATEST(0, wanted_level_value - 1))::jsonb);
    END IF;

    RETURN game_logic.check_failure_state(next_session);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.start_session(initial_session_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_session JSONB := initial_session_text::jsonb;
    session_id_value TEXT := COALESCE(next_session #>> '{meta,sessionId}', '');
BEGIN
    RETURN '{"ok":true,"sessionId":' || to_json(session_id_value)::text || ',"session":' || next_session::text || '}';
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.execute_trade(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    station_id_value INT := (payload_json->>'stationId')::INT;
    goods_id_value INT := (payload_json->>'goodsId')::INT;
    quantity_value INT := (payload_json->>'quantity')::INT;
    trade_type_value TEXT := payload_json->>'tradeType';
    station_json JSONB;
    goods_json JSONB;
    inventory_item JSONB;
    cargo_item JSONB;
    unit_price_value INT;
    cargo_used_value INT;
    next_session JSONB := session_json;
    next_stations JSONB;
    next_goods_json JSONB;
    next_cargo JSONB;
    base_shift_value INT;
    next_price_value INT;
    current_credits_value BIGINT := COALESCE((session_json #>> '{player,credits}')::BIGINT, 0);
    ripple_affected JSONB := '[]'::jsonb;
    affected_entry JSONB;
    affected_station_id_value INT;
    affected_hop_value INT;
    affected_station_json JSONB;
    affected_inventory_item JSONB;
    delta_value INT;
    ripple_price_value INT;
    affected_station_ids_text TEXT := '';
    affected_station_ids_json TEXT;
BEGIN
    station_json := game_logic.find_station(session_json, station_id_value);
    IF station_json IS NULL OR COALESCE((session_json #>> '{player,currentStationId}')::INT, -1) <> station_id_value THEN
        RETURN game_logic.error_result('INVALID_STATION', 'Current station does not match trade station.');
    END IF;

    goods_json := game_logic.find_goods(session_json->'goods', goods_id_value);
    inventory_item := game_logic.station_inventory_item(station_json, goods_id_value);
    IF goods_json IS NULL OR inventory_item IS NULL THEN
        RETURN game_logic.error_result('INVALID_GOODS', 'Goods not found in station inventory.');
    END IF;

    cargo_item := game_logic.find_cargo_item(session_json #> '{player,cargo}', goods_id_value);
    cargo_used_value := game_logic.cargo_used(session_json #> '{player,cargo}');
    unit_price_value := (inventory_item->>'currentPrice')::INT;

    IF trade_type_value = 'buy' THEN
        IF (inventory_item->>'stock')::INT < quantity_value THEN
            RETURN game_logic.error_result('STOCK_NOT_ENOUGH', 'Station stock is not enough.');
        END IF;
        IF current_credits_value < unit_price_value * quantity_value THEN
            RETURN game_logic.error_result('INSUFFICIENT_FUNDS', 'Insufficient credits.');
        END IF;
        IF cargo_used_value + quantity_value > COALESCE((session_json #>> '{player,cargoCapacity}')::INT, 0) THEN
            RETURN game_logic.error_result('CARGO_FULL', 'Cargo hold is full.');
        END IF;
    ELSIF cargo_item IS NULL OR (cargo_item->>'quantity')::INT < quantity_value THEN
        RETURN game_logic.error_result('NO_CARGO', 'Not enough cargo to sell.');
    END IF;

    IF trade_type_value = 'buy' THEN
        next_session := game_logic.set_json_value(
            next_session,
            ARRAY['player', 'credits']::TEXT[],
            to_json(current_credits_value - (unit_price_value * quantity_value))::jsonb
        );
    ELSE
        next_session := game_logic.set_json_value(
            next_session,
            ARRAY['player', 'credits']::TEXT[],
            to_json(current_credits_value + (unit_price_value * quantity_value))::jsonb
        );
    END IF;

    next_goods_json := game_logic.find_goods(next_session->'goods', goods_id_value);
    next_cargo := game_logic.update_cargo(next_session #> '{player,cargo}', next_goods_json, quantity_value, unit_price_value, trade_type_value);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'cargo']::TEXT[], next_cargo);

    next_session := game_logic.set_json_value(
        next_session,
        ARRAY['stats', 'tradeCount']::TEXT[],
        to_json(COALESCE((next_session #>> '{stats,tradeCount}')::INT, 0) + 1)::jsonb
    );

    base_shift_value := GREATEST(4, ROUND(quantity_value * 1.4)::INT);
    IF trade_type_value = 'buy' THEN
        next_price_value := unit_price_value + base_shift_value;
        next_stations := game_logic.update_stations_inventory(next_session->'stations', station_id_value, goods_id_value, -quantity_value, next_price_value);
    ELSE
        next_price_value := GREATEST(1, unit_price_value - base_shift_value);
        next_stations := game_logic.update_stations_inventory(next_session->'stations', station_id_value, goods_id_value, quantity_value, next_price_value);
    END IF;
    next_session := game_logic.set_json_value(next_session, ARRAY['stations']::TEXT[], next_stations);

    ripple_affected := game_logic.compute_ripple_affected(next_session->'routes', station_id_value);
    FOR affected_entry IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(ripple_affected, '[]'::jsonb))
    LOOP
        affected_station_id_value := (affected_entry->>'stationId')::INT;
        affected_hop_value := (affected_entry->>'hop')::INT;
        affected_station_json := game_logic.find_station(next_session, affected_station_id_value);
        IF affected_station_json IS NULL THEN
            CONTINUE;
        END IF;

        affected_inventory_item := game_logic.station_inventory_item(affected_station_json, goods_id_value);
        IF affected_inventory_item IS NULL THEN
            CONTINUE;
        END IF;

        delta_value := GREATEST(
            1,
            ROUND(
                (base_shift_value * (1.0 / affected_hop_value))
                * (1.0 / COALESCE((affected_station_json->>'independenceFactor')::NUMERIC, 1))
            )::INT
        );
        IF trade_type_value = 'buy' THEN
            ripple_price_value := (affected_inventory_item->>'currentPrice')::INT + delta_value;
        ELSE
            ripple_price_value := GREATEST(1, (affected_inventory_item->>'currentPrice')::INT - delta_value);
        END IF;

        next_stations := game_logic.update_stations_inventory(next_session->'stations', affected_station_id_value, goods_id_value, 0, ripple_price_value);
        next_session := game_logic.set_json_value(next_session, ARRAY['stations']::TEXT[], next_stations);
        affected_station_ids_text := affected_station_ids_text || ',' || affected_station_id_value::TEXT;
    END LOOP;

    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'tradeModal', 'errorMessage']::TEXT[], 'null'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'tradeModal', 'isSubmitting']::TEXT[], 'false'::jsonb);

    affected_station_ids_json := '[' || station_id_value::TEXT || affected_station_ids_text || ']';
    next_session := game_logic.set_json_value(
        next_session,
        ARRAY['ui', 'ripple']::TEXT[],
        ('{"affectedStationIds":' || affected_station_ids_json || ',"startedAt":0}')::jsonb
    );

    next_session := game_logic.advance_world_state(game_logic.check_failure_state(next_session), 1);

    RETURN game_logic.ok_result(
        next_session,
        ',"rippleAffectedStationIds":' || affected_station_ids_json
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.deposit_warehouse(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    station_id_value INT := (payload_json->>'stationId')::INT;
    goods_id_value INT := (payload_json->>'goodsId')::INT;
    quantity_value INT := (payload_json->>'quantity')::INT;
    cargo_item JSONB;
    next_session JSONB := session_json;
    next_cargo JSONB := '[]'::jsonb;
    current_item JSONB;
    warehouse_entries JSONB;
    warehouse_entry JSONB;
    updated_entries JSONB := '[]'::jsonb;
    found_entry BOOLEAN := false;
BEGIN
    IF COALESCE((session_json #>> '{player,currentStationId}')::INT, -1) <> station_id_value THEN
        RETURN '{"ok":false,"message":"You must be at the current station to deposit goods."}';
    END IF;

    cargo_item := game_logic.find_cargo_item(session_json #> '{player,cargo}', goods_id_value);
    IF cargo_item IS NULL OR (cargo_item->>'quantity')::INT < quantity_value THEN
        RETURN '{"ok":false,"message":"Not enough cargo to deposit."}';
    END IF;

    FOR current_item IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(session_json #> '{player,cargo}', '[]'::jsonb))
    LOOP
        IF (current_item->>'goodsId')::INT = goods_id_value THEN
            IF (current_item->>'quantity')::INT - quantity_value > 0 THEN
                next_cargo := game_logic.append_jsonb_array(
                    next_cargo,
                    game_logic.set_json_value(
                        current_item,
                        ARRAY['quantity']::TEXT[],
                        to_json((current_item->>'quantity')::INT - quantity_value)::jsonb
                    )
                );
            END IF;
        ELSE
            next_cargo := game_logic.append_jsonb_array(next_cargo, current_item);
        END IF;
    END LOOP;

    warehouse_entries := COALESCE(session_json->'warehouses'->station_id_value::TEXT, '[]'::jsonb);
    FOR warehouse_entry IN
        SELECT value
        FROM jsonb_array_elements(warehouse_entries)
    LOOP
        IF (warehouse_entry->>'goodsId')::INT = goods_id_value THEN
            found_entry := true;
            updated_entries := game_logic.append_jsonb_array(
                updated_entries,
                game_logic.set_json_value(
                    warehouse_entry,
                    ARRAY['quantity']::TEXT[],
                    to_json((warehouse_entry->>'quantity')::INT + quantity_value)::jsonb
                )
            );
        ELSE
            updated_entries := game_logic.append_jsonb_array(updated_entries, warehouse_entry);
        END IF;
    END LOOP;

    IF NOT found_entry THEN
        updated_entries := game_logic.append_jsonb_array(
            updated_entries,
            ('{"goodsId":' || goods_id_value::TEXT || ',"quantity":' || quantity_value::TEXT || ',"storedTurns":0}')::jsonb
        );
    END IF;

    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'cargo']::TEXT[], next_cargo);
    next_session := game_logic.set_json_value(next_session, ARRAY['warehouses', station_id_value::TEXT]::TEXT[], updated_entries);

    RETURN game_logic.ok_result(next_session);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.withdraw_warehouse(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    station_id_value INT := (payload_json->>'stationId')::INT;
    goods_id_value INT := (payload_json->>'goodsId')::INT;
    quantity_value INT := (payload_json->>'quantity')::INT;
    warehouse_entries JSONB;
    warehouse_entry JSONB;
    goods_json JSONB;
    next_session JSONB := session_json;
    next_entries JSONB := '[]'::jsonb;
    cargo_item JSONB;
    cargo_json JSONB;
    current_item JSONB;
    found_entry BOOLEAN := false;
    tax_paid_value INT;
    cargo_used_value INT;
    total_quantity_value INT;
BEGIN
    IF COALESCE((session_json #>> '{player,currentStationId}')::INT, -1) <> station_id_value THEN
        RETURN '{"ok":false,"message":"You must be at the current station to withdraw goods."}';
    END IF;

    warehouse_entries := COALESCE(session_json->'warehouses'->station_id_value::TEXT, '[]'::jsonb);
    warehouse_entry := game_logic.find_cargo_item(warehouse_entries, goods_id_value);
    IF warehouse_entry IS NULL OR (warehouse_entry->>'quantity')::INT < quantity_value THEN
        RETURN '{"ok":false,"message":"Not enough stored goods in this station warehouse."}';
    END IF;

    cargo_used_value := game_logic.cargo_used(session_json #> '{player,cargo}');
    IF cargo_used_value + quantity_value > COALESCE((session_json #>> '{player,cargoCapacity}')::INT, 0) THEN
        RETURN '{"ok":false,"message":"Not enough cargo capacity."}';
    END IF;

    goods_json := game_logic.find_goods(session_json->'goods', goods_id_value);
    IF goods_json IS NULL THEN
        RETURN '{"ok":false,"message":"Goods not found."}';
    END IF;

    tax_paid_value := game_logic.calculate_withdraw_tax(
        quantity_value,
        COALESCE((session_json #>> '{player,wantedLevel}')::INT, 0),
        COALESCE((warehouse_entry->>'storedTurns')::INT, 0)
    );
    IF COALESCE((session_json #>> '{player,credits}')::INT, 0) < tax_paid_value THEN
        RETURN '{"ok":false,"message":"Insufficient credits to pay warehouse tax."}';
    END IF;

    FOR current_item IN
        SELECT value
        FROM jsonb_array_elements(warehouse_entries)
    LOOP
        IF (current_item->>'goodsId')::INT = goods_id_value THEN
            IF (current_item->>'quantity')::INT - quantity_value > 0 THEN
                next_entries := game_logic.append_jsonb_array(
                    next_entries,
                    game_logic.set_json_value(
                        current_item,
                        ARRAY['quantity']::TEXT[],
                        to_json((current_item->>'quantity')::INT - quantity_value)::jsonb
                    )
                );
            END IF;
        ELSE
            next_entries := game_logic.append_jsonb_array(next_entries, current_item);
        END IF;
    END LOOP;

    cargo_json := '[]'::jsonb;
    cargo_item := game_logic.find_cargo_item(session_json #> '{player,cargo}', goods_id_value);
    IF cargo_item IS NULL THEN
        cargo_json := COALESCE(session_json #> '{player,cargo}', '[]'::jsonb);
        cargo_json := game_logic.append_jsonb_array(
            cargo_json,
            json_build_object(
                'goodsId', goods_id_value,
                'goodsName', goods_json->>'name',
                'quantity', quantity_value,
                'avgCost', (goods_json->>'basePrice')::INT,
                'isContraband', (goods_json->>'isContraband')::BOOLEAN
            )
        ::jsonb);
    ELSE
        FOR current_item IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(session_json #> '{player,cargo}', '[]'::jsonb))
        LOOP
            IF (current_item->>'goodsId')::INT = goods_id_value THEN
                total_quantity_value := (current_item->>'quantity')::INT + quantity_value;
                cargo_json := game_logic.append_jsonb_array(
                    cargo_json,
                    json_build_object(
                        'goodsId', goods_id_value,
                        'goodsName', goods_json->>'name',
                        'quantity', total_quantity_value,
                        'avgCost',
                        ROUND((((current_item->>'avgCost')::NUMERIC * (current_item->>'quantity')::NUMERIC) + ((goods_json->>'basePrice')::NUMERIC * quantity_value)) / total_quantity_value),
                        'isContraband', (goods_json->>'isContraband')::BOOLEAN
                    )
                ::jsonb);
            ELSE
                cargo_json := game_logic.append_jsonb_array(cargo_json, current_item);
            END IF;
        END LOOP;
    END IF;

    next_session := game_logic.set_json_value(
        next_session,
        ARRAY['player', 'credits']::TEXT[],
        to_json(COALESCE((session_json #>> '{player,credits}')::INT, 0) - tax_paid_value)::jsonb
    );
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'cargo']::TEXT[], cargo_json);
    next_session := game_logic.set_json_value(next_session, ARRAY['warehouses', station_id_value::TEXT]::TEXT[], next_entries);

    RETURN game_logic.ok_result(next_session, ',"taxPaid":' || tax_paid_value::TEXT);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.start_move(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    station_id_value INT := (payload_json->>'stationId')::INT;
    target_station_id_value INT := (payload_json->>'targetStationId')::INT;
    years_cost_value INT := (payload_json->>'yearsCost')::INT;
    encounter_roll_value NUMERIC := COALESCE((payload_json->>'encounterRoll')::NUMERIC, 0.99);
    encounter_index_value INT := COALESCE((payload_json->>'encounterIndex')::INT, 0);
    route_json JSONB;
    next_session JSONB := session_json;
    encounter_json JSONB := NULL;
BEGIN
    route_json := game_logic.find_route(session_json->'routes', station_id_value, target_station_id_value);
    IF route_json IS NULL THEN
        RETURN game_logic.error_result('INVALID_ROUTE', 'No valid route between stations.');
    END IF;

    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'currentStationId']::TEXT[], to_json(target_station_id_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'status']::TEXT[], '"TRAVELING"'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'activeTravel']::TEXT[], 'null'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'hoveredStationId']::TEXT[], 'null'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'selectedTargetStationId']::TEXT[], 'null'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'moveState']::TEXT[], '"traveling"'::jsonb);
    next_session := game_logic.set_json_value(
        next_session,
        ARRAY['ui', 'pendingAction']::TEXT[],
        json_build_object(
            'type', 'move',
            'stationId', station_id_value,
            'targetStationId', target_station_id_value,
            'yearsCost', years_cost_value,
            'baseYearsSettled', false
        )::jsonb
    );

    IF encounter_roll_value <= 0.3 THEN
        encounter_json := game_logic.find_encounter(encounter_index_value);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'open']::TEXT[], 'true'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'eventId']::TEXT[], to_json(encounter_json->>'id')::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'title']::TEXT[], to_json(encounter_json->>'title')::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'description']::TEXT[], to_json(encounter_json->>'description')::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'choices']::TEXT[], encounter_json->'choices');
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'selectedChoiceId']::TEXT[], 'null'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'result']::TEXT[], 'null'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'isResolving']::TEXT[], 'false'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'moveState']::TEXT[], '"event_blocking"'::jsonb);
    ELSE
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'open']::TEXT[], 'false'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'eventId']::TEXT[], 'null'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'title']::TEXT[], '""'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'description']::TEXT[], '""'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'choices']::TEXT[], '[]'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'selectedChoiceId']::TEXT[], 'null'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'result']::TEXT[], 'null'::jsonb);
        next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'isResolving']::TEXT[], 'false'::jsonb);
    END IF;

    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'lastPersistedAt']::TEXT[], to_json(game_logic.now_iso())::jsonb);
    RETURN game_logic.ok_result(next_session, ',"encounter":' || COALESCE(encounter_json::text, 'null'));
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.resolve_encounter(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
BEGIN
    RETURN game_logic.ok_result(
        session_json,
        ',"result":{"success":true,"message":"事件处理完成。"}'
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.finalize_encounter(session_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
BEGIN
    RETURN game_logic.ok_result(session_json);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.advance_world(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
BEGIN
    RETURN game_logic.ok_result(session_json);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.find_encounter_choice(choices_json JSONB, choice_id_value INT)
RETURNS JSONB
LANGUAGE SQL
AS $$
    SELECT choice_item
    FROM jsonb_array_elements(COALESCE(choices_json, '[]'::jsonb)) choice_item
    WHERE (choice_item->>'choiceId')::INT = choice_id_value
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game_logic.resolve_encounter_v2(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    choice_id_value INT := (payload_json->>'choiceId')::INT;
    pending_action_json JSONB := payload_json->'pendingAction';
    encounter_event_id TEXT := session_json #>> '{ui,encounter,eventId}';
    next_session JSONB := session_json;
    choice_json JSONB;
    effect_json JSONB;
    credits_delta_value INT := 0;
    year_delta_value INT := 0;
    end_year_delta_value INT := 0;
    wanted_level_delta_value INT := 0;
    detained_years_delta_value INT := 0;
    current_credits_value BIGINT := COALESCE((session_json #>> '{player,credits}')::BIGINT, 0);
    current_year_value INT := COALESCE((session_json #>> '{meta,currentYear}')::INT, 0);
    end_year_value INT := COALESCE((session_json #>> '{meta,endYear}')::INT, 0);
    wanted_level_value INT := COALESCE((session_json #>> '{player,wantedLevel}')::INT, 0);
    suspicion_value INT := COALESCE((session_json #>> '{player,suspicion}')::INT, 0);
    detained_years_value INT := COALESCE((session_json #>> '{player,detainedYears}')::INT, 0);
    event_count_value INT := COALESCE((session_json #>> '{stats,eventCount}')::INT, 0);
    result_message TEXT := '事件处理完成。';
BEGIN
    IF encounter_event_id IS NULL OR encounter_event_id = '' THEN
        RETURN '{"ok":false,"result":{"success":false,"message":"No active encounter to resolve."},"session":' || session_json::text || '}';
    END IF;

    choice_json := game_logic.find_encounter_choice(session_json #> '{ui,encounter,choices}', choice_id_value);
    IF choice_json IS NULL THEN
        RETURN '{"ok":false,"result":{"success":false,"message":"Invalid encounter choice."},"session":' || session_json::text || '}';
    END IF;

    effect_json := COALESCE(choice_json->'effect', '{}'::jsonb);
    credits_delta_value := COALESCE((effect_json->>'creditsDelta')::INT, 0);
    year_delta_value := GREATEST(0, COALESCE((effect_json->>'yearDelta')::INT, 0));
    end_year_delta_value := GREATEST(0, COALESCE((effect_json->>'endYearDelta')::INT, 0));
    wanted_level_delta_value := COALESCE((effect_json->>'wantedLevelDelta')::INT, 0);
    detained_years_delta_value := GREATEST(0, COALESCE((effect_json->>'detainedYearsDelta')::INT, 0));

    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'pendingAction']::TEXT[], pending_action_json);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'selectedChoiceId']::TEXT[], to_json(choice_id_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'isResolving']::TEXT[], 'true'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'credits']::TEXT[], to_json(current_credits_value + credits_delta_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'currentYear']::TEXT[], to_json(current_year_value + year_delta_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'endYear']::TEXT[], to_json(end_year_value + end_year_delta_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'wantedLevel']::TEXT[], to_json(LEAST(3, GREATEST(0, wanted_level_value + wanted_level_delta_value)))::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'suspicion']::TEXT[], to_json(LEAST(999, GREATEST(0, suspicion_value + GREATEST(0, wanted_level_delta_value * 15))))::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['player', 'detainedYears']::TEXT[], to_json(detained_years_value + detained_years_delta_value)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['stats', 'eventCount']::TEXT[], to_json(event_count_value + 1)::jsonb);

    IF credits_delta_value > 0 THEN
        result_message := '你获得了 ' || to_char(credits_delta_value, 'FM999999999') || ' CR。';
    ELSIF year_delta_value > 0 THEN
        result_message := '你额外消耗了 ' || year_delta_value::TEXT || ' 世界年份。';
    ELSIF end_year_delta_value > 0 THEN
        result_message := '终止年份延后了 ' || end_year_delta_value::TEXT || ' 年。';
    ELSIF credits_delta_value < 0 THEN
        result_message := '你损失了 ' || to_char(ABS(credits_delta_value), 'FM999999999') || ' CR。';
    END IF;

    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'encounter', 'result']::TEXT[], json_build_object('success', true, 'message', result_message)::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'lastPersistedAt']::TEXT[], to_json(game_logic.now_iso())::jsonb);
    next_session := game_logic.check_failure_state(next_session);

    RETURN game_logic.ok_result(next_session, ',"result":{"success":true,"message":' || to_json(result_message)::text || '}');
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.finalize_encounter_v2(session_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    next_session JSONB := session_json;
    years_elapsed_value INT := 0;
BEGIN
    IF session_json #>> '{ui,pendingAction,type}' = 'move'
       AND COALESCE((session_json #>> '{ui,pendingAction,baseYearsSettled}')::BOOLEAN, true) = false THEN
        years_elapsed_value := COALESCE((session_json #>> '{ui,pendingAction,yearsCost}')::INT, 0);
    END IF;

    next_session := game_logic.advance_world_state(session_json, years_elapsed_value);
    next_session := game_logic.set_json_value(next_session, ARRAY['ui', 'pendingAction', 'baseYearsSettled']::TEXT[], 'true'::jsonb);
    next_session := game_logic.set_json_value(next_session, ARRAY['meta', 'lastPersistedAt']::TEXT[], to_json(game_logic.now_iso())::jsonb);
    RETURN game_logic.ok_result(next_session);
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.advance_world_v2(session_text TEXT, payload_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    payload_json JSONB := payload_text::jsonb;
    years_elapsed_value INT := COALESCE((payload_json->>'yearsElapsed')::INT, 0);
BEGIN
    RETURN game_logic.ok_result(
        game_logic.set_json_value(
            game_logic.advance_world_state(session_json, years_elapsed_value),
            ARRAY['meta', 'lastPersistedAt']::TEXT[],
            to_json(game_logic.now_iso())::jsonb
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.evaluate_settlement(session_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    session_json JSONB := session_text::jsonb;
    monopoly_count_value INT := game_logic.compute_monopoly_count(session_json);
    result_code_value TEXT := game_logic.derive_settlement_result(session_json, monopoly_count_value);
    final_credits_value BIGINT := COALESCE((session_json #>> '{player,credits}')::BIGINT, 0);
    player_name_value TEXT := COALESCE(session_json #>> '{player,name}', '');
    trade_count_value INT := COALESCE((session_json #>> '{stats,tradeCount}')::INT, 0);
    event_count_value INT := COALESCE((session_json #>> '{stats,eventCount}')::INT, 0);
    credits_bonus_value INT := ROUND(final_credits_value * 0.5)::INT;
    monopoly_bonus_value INT := monopoly_count_value * 5000;
    trade_bonus_value INT := trade_count_value * 100;
    event_bonus_value INT := event_count_value * 200;
    total_value INT := credits_bonus_value + monopoly_bonus_value + trade_bonus_value + event_bonus_value;
BEGIN
    RETURN (
        '{'
        || '"result":' || to_json(result_code_value)::text
        || ',"playerName":' || to_json(player_name_value)::text
        || ',"finalCredits":' || final_credits_value::TEXT
        || ',"monopolyCount":' || monopoly_count_value::TEXT
        || ',"tradeCount":' || trade_count_value::TEXT
        || ',"eventCount":' || event_count_value::TEXT
        || ',"breakdown":{'
        || '"creditsBonus":' || credits_bonus_value::TEXT
        || ',"monopolyBonus":' || monopoly_bonus_value::TEXT
        || ',"tradeBonus":' || trade_bonus_value::TEXT
        || ',"eventBonus":' || event_bonus_value::TEXT
        || ',"total":' || total_value::TEXT
        || '}'
        || '}'
    );
END;
$$;

CREATE OR REPLACE FUNCTION game_logic.complete_settlement(
    session_id_value TEXT,
    session_text TEXT,
    account_id_value TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    existing_record RECORD;
    existing_record_count INT := 0;
    settlement_payload_text TEXT;
    settlement_payload_json JSONB;
    final_score_value INT;
    result_code_value TEXT;
    account_row RECORD;
    updated_account_row RECORD;
    record_row RECORD;
    account_json_text TEXT := 'null';
BEGIN
    SELECT COUNT(*)
    INTO existing_record_count
    FROM public.settlement_records
    WHERE session_id = session_id_value;

    IF existing_record_count > 0 THEN
        SELECT record_id, session_id, account_id, final_score, result_code, settlement_json, created_at
        INTO existing_record
        FROM public.settlement_records
        WHERE session_id = session_id_value
        LIMIT 1;

        IF account_id_value IS NOT NULL THEN
            SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
            INTO account_row
            FROM public.accounts
            WHERE account_id = account_id_value;

            IF FOUND THEN
                account_json_text := (
                    '{'
                    || '"id":' || to_json(account_row.account_id)::text
                    || ',"email":' || to_json(account_row.email)::text
                    || ',"passwordMock":' || to_json(account_row.password_mock)::text
                    || ',"nickname":' || to_json(account_row.nickname)::text
                    || ',"createdAt":' || to_json(account_row.created_at::text)::text
                    || ',"updatedAt":' || to_json(account_row.updated_at::text)::text
                    || ',"bestScore":' || account_row.best_score::TEXT
                    || ',"bestScoreUpdatedAt":' || COALESCE(to_json(account_row.best_score_updated_at::text)::text, 'null')
                    || '}'
                );
            END IF;
        END IF;

        RETURN (
            '{'
            || '"ok":true'
            || ',"settlement":' || existing_record.settlement_json
            || ',"account":' || account_json_text
            || ',"archived":true'
            || '}'
        );
    END IF;

    IF account_id_value IS NOT NULL THEN
        SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
        INTO account_row
        FROM public.accounts
        WHERE account_id = account_id_value;

        IF NOT FOUND THEN
            RETURN '{"ok":false,"message":"Account not found","code":"ACCOUNT_NOT_FOUND"}';
        END IF;
    END IF;

    settlement_payload_text := game_logic.evaluate_settlement(session_text);
    settlement_payload_json := settlement_payload_text::jsonb;
    final_score_value := COALESCE((settlement_payload_json #>> '{breakdown,total}')::INT, 0);
    result_code_value := COALESCE(settlement_payload_json->>'result', 'timeup');

    IF account_id_value IS NOT NULL THEN
        IF final_score_value > account_row.best_score THEN
            UPDATE public.accounts
            SET best_score = final_score_value,
                best_score_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE account_id = account_id_value
            RETURNING account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
            INTO updated_account_row;
        ELSE
            SELECT account_row.account_id,
                   account_row.email,
                   account_row.password_mock,
                   account_row.nickname,
                   account_row.created_at,
                   account_row.updated_at,
                   account_row.best_score,
                   account_row.best_score_updated_at
            INTO updated_account_row;
        END IF;

        account_json_text := (
            '{'
            || '"id":' || to_json(updated_account_row.account_id)::text
            || ',"email":' || to_json(updated_account_row.email)::text
            || ',"passwordMock":' || to_json(updated_account_row.password_mock)::text
            || ',"nickname":' || to_json(updated_account_row.nickname)::text
            || ',"createdAt":' || to_json(updated_account_row.created_at::text)::text
            || ',"updatedAt":' || to_json(updated_account_row.updated_at::text)::text
            || ',"bestScore":' || updated_account_row.best_score::TEXT
            || ',"bestScoreUpdatedAt":' || COALESCE(to_json(updated_account_row.best_score_updated_at::text)::text, 'null')
            || '}'
        );
    END IF;

    INSERT INTO public.settlement_records (
        record_id,
        session_id,
        account_id,
        final_score,
        result_code,
        settlement_json
    )
    VALUES (
        'stl-' || replace(cast(clock_timestamp() AS text), ' ', '-') || '-' || substr(md5(session_id_value), 1, 8),
        session_id_value,
        account_id_value,
        final_score_value,
        result_code_value,
        settlement_payload_text
    )
    RETURNING record_id, session_id, account_id, final_score, result_code, settlement_json, created_at
    INTO record_row;

    RETURN (
        '{'
        || '"ok":true'
        || ',"settlement":'
        || (
            LEFT(record_row.settlement_json, LENGTH(record_row.settlement_json) - 1)
            || ',"recordId":' || to_json(record_row.record_id)::text
            || ',"finalizedAt":' || to_json(record_row.created_at::text)::text
            || ',"accountId":' || COALESCE(to_json(record_row.account_id)::text, 'null')
            || '}'
        )
        || ',"account":' || account_json_text
        || ',"archived":true'
        || '}'
    );
END;
$$;
