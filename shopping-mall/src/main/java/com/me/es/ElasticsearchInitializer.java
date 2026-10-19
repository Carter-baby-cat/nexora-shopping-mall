package com.me.es;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class ElasticsearchInitializer {

    private static final String INDEX_NAME = "shopping_index";

    private final ElasticsearchOperations operations;

    public ElasticsearchInitializer(ElasticsearchOperations operations) {
        this.operations = operations;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {

        IndexOperations indexOps =
                operations.indexOps(IndexCoordinates.of(INDEX_NAME));

        if (indexOps.exists()) {
            log.info("Elasticsearch index [{}] already exists", INDEX_NAME);
            return;
        }

        // =========================
        // settings
        // =========================

        Map<String, Object> settings = new HashMap<>();

        Map<String, Object> analysis = new HashMap<>();

        // ---------- filter ----------

        Map<String, Object> filter = new HashMap<>();

        Map<String, Object> pinyinFilter = new HashMap<>();

        pinyinFilter.put("type", "pinyin");
        pinyinFilter.put("keep_first_letter", true);
        pinyinFilter.put("keep_separate_first_letter", false);
        pinyinFilter.put("keep_full_pinyin", true);
        pinyinFilter.put("keep_joined_full_pinyin", true);
        pinyinFilter.put("keep_original", true);
        pinyinFilter.put("lowercase", true);
        pinyinFilter.put("remove_duplicated_term", true);

        filter.put("item_pinyin_filter", pinyinFilter);

        analysis.put("filter", filter);

        // ---------- analyzer ----------

        Map<String, Object> analyzers = new HashMap<>();

        Map<String, Object> completionAnalyzer = new HashMap<>();

        completionAnalyzer.put("type", "custom");
        completionAnalyzer.put("tokenizer", "keyword");
        completionAnalyzer.put(
                "filter",
                new String[]{"item_pinyin_filter"}
        );

        analyzers.put(
                "item_completion_analyzer",
                completionAnalyzer
        );

        analysis.put("analyzer", analyzers);

        settings.put("analysis", analysis);

        // =========================
        // mappings
        // =========================

        Document mapping = Document.create();

        Map<String, Object> properties = new HashMap<>();

        properties.put("id", field("long"));

        properties.put("merchant_id", field("long"));

        // name
        Map<String, Object> name = field("text");
        name.put("analyzer", "ik_max_word");
        name.put("search_analyzer", "ik_smart");
        properties.put("name", name);

        // suggest
        Map<String, Object> suggest = field("completion");
        suggest.put("analyzer", "item_completion_analyzer");
        suggest.put("search_analyzer", "item_completion_analyzer");
        suggest.put("preserve_separators", false);
        suggest.put("preserve_position_increments", false);
        suggest.put("max_input_length", 50);
        properties.put("suggest", suggest);

        properties.put("category", field("keyword"));

        properties.put("brand", field("keyword"));

        properties.put("price", field("double"));

        properties.put("stock", field("integer"));

        // description
        Map<String, Object> description = field("text");
        description.put("analyzer", "ik_max_word");
        description.put("search_analyzer", "ik_smart");
        properties.put("description", description);

        // image_urls
        Map<String, Object> imageUrls = field("keyword");
        imageUrls.put("index", false);
        properties.put("image_urls", imageUrls);

        properties.put("status", field("keyword"));

        properties.put("is_seckill", field("boolean"));

        // end_time
        Map<String, Object> endTime = field("date");
        endTime.put(
                "format",
                "yyyy-MM-dd HH:mm:ss||strict_date_optional_time"
        );
        properties.put("end_time", endTime);

        mapping.put("properties", properties);

        // =========================
        // create index
        // =========================

        boolean created = indexOps.create(settings, mapping);

        if (created) {
            log.info("Elasticsearch index [{}] creation succeeded", INDEX_NAME);

        } else {
            log.info("Elasticsearch index [{}] creation failed", INDEX_NAME);
        }
    }

    private Map<String, Object> field(String type) {
        Map<String, Object> field = new HashMap<>();
        field.put("type", type);
        return field;
    }
}